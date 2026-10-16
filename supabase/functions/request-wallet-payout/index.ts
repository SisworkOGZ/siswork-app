import {
  adminRequest,
  errorResponse,
  getAuthenticatedUser,
  handleOptions,
  jsonResponse,
} from "../_shared/http.ts";

type Withdrawal = {
  id: string;
  seller_id: string;
  amount: number;
  provider: "DANA" | "OVO" | "GoPay" | "ShopeePay";
  account_number: string;
  recipient_name: string;
  provider_reference: string | null;
  status: "processing" | "completed" | "failed";
};

const normalizedPhone = (value: string) =>
  value.startsWith("62") ? `0${value.slice(2)}` : value;

async function updateWithdrawal(
  id: string,
  providerReference: string | null,
  status: Withdrawal["status"],
  failureReason: string | null = null,
) {
  return adminRequest<Withdrawal | Withdrawal[]>(
    "rpc/update_seller_withdrawal",
    {
      method: "POST",
      body: JSON.stringify({
        p_withdrawal_id: id,
        p_provider_reference: providerReference,
        p_status: status,
        p_failure_reason: failureReason,
      }),
    },
  );
}

async function sendMidtransPayout(
  withdrawal: Withdrawal,
  email: string | null,
): Promise<{ reference: string; status: Withdrawal["status"] }> {
  const apiKey = Deno.env.get("MIDTRANS_PAYOUT_API_KEY");
  if (!apiKey) {
    throw new Error("MIDTRANS_PAYOUT_API_KEY belum diatur pada Supabase Secrets.");
  }
  const production = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true";
  const baseUrl = production
    ? "https://app.midtrans.com/iris/api/v1"
    : "https://app.sandbox.midtrans.com/iris/api/v1";
  const response = await fetch(`${baseUrl}/payouts`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${btoa(`${apiKey}:`)}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": withdrawal.id,
    },
    body: JSON.stringify({
      payouts: [
        {
          beneficiary_name: withdrawal.recipient_name,
          beneficiary_account: normalizedPhone(withdrawal.account_number),
          beneficiary_bank: withdrawal.provider.toLowerCase(),
          beneficiary_email: email ?? undefined,
          amount: String(withdrawal.amount),
          notes: `Siswork ${withdrawal.id.slice(0, 8)}`,
        },
      ],
    }),
  });
  const result = (await response.json()) as {
    payouts?: { reference_no?: string; status?: string }[];
    error_message?: string;
    errors?: string;
  };
  const payout = result.payouts?.[0];
  if (!response.ok || !payout?.reference_no) {
    throw new Error(
      result.error_message ??
        result.errors ??
        `Midtrans menolak payout (${response.status}).`,
    );
  }
  return {
    reference: payout.reference_no,
    status: payout.status === "completed" ? "completed" : "processing",
  };
}

async function sendXenditPayout(
  withdrawal: Withdrawal,
  email: string | null,
): Promise<{ reference: string; status: Withdrawal["status"] }> {
  const secretKey = Deno.env.get("XENDIT_SECRET_KEY");
  if (!secretKey) {
    throw new Error("XENDIT_SECRET_KEY belum diatur pada Supabase Secrets.");
  }
  const nameParts = withdrawal.recipient_name.trim().split(/\s+/);
  const response = await fetch("https://api.xendit.co/v3/payouts", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${btoa(`${secretKey}:`)}`,
      "Content-Type": "application/json",
      "Idempotency-key": withdrawal.id,
      "Api-version": "2025-09-01",
    },
    body: JSON.stringify({
      reference_id: withdrawal.id,
      recipient: {
        type: "INDIVIDUAL",
        given_name: nameParts[0],
        surname: nameParts.slice(1).join(" ") || nameParts[0],
        relationship: "CUSTOMER",
        details: {
          personal_mobile_number: `+62${normalizedPhone(withdrawal.account_number).replace(/^0/, "")}`,
        },
        account_details: {
          currency: "IDR",
          account_country: "ID",
          account_holder_name: withdrawal.recipient_name,
          account_number: normalizedPhone(withdrawal.account_number),
          routing_type_1: "WALLET",
          routing_value_1:
            withdrawal.provider === "DANA" ? "ID_DANA" : "ID_SHOPEEPAY",
        },
      },
      payout_details: {
        source_currency: "IDR",
        destination_currency: "IDR",
        destination_amount: withdrawal.amount,
      },
      source_of_fund: "BUSINESS_REVENUE",
      purpose_code: "SALARY",
      description: `Siswork ${withdrawal.id.slice(0, 8)}`,
      metadata: { seller_email: email ?? "" },
    }),
  });
  const result = (await response.json()) as {
    payout_id?: string;
    status?: string;
    message?: string;
    error_code?: string;
  };
  if (!response.ok || !result.payout_id) {
    throw new Error(
      result.message ??
        result.error_code ??
        `Xendit menolak payout (${response.status}).`,
    );
  }
  return {
    reference: result.payout_id,
    status:
      result.status === "SUCCEEDED"
        ? "completed"
        : result.status === "FAILED"
          ? "failed"
          : "processing",
  };
}

Deno.serve(async (request: Request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method tidak didukung." }, 405);
  }

  let withdrawal: Withdrawal | undefined;
  try {
    const user = await getAuthenticatedUser(request);
    const body = (await request.json()) as {
      amount?: number;
      idempotencyKey?: string;
    };
    if (
      !Number.isSafeInteger(body.amount) ||
      Number(body.amount) <= 0 ||
      !body.idempotencyKey ||
      !/^[0-9a-f-]{36}$/i.test(body.idempotencyKey)
    ) {
      return jsonResponse(
        { error: "Jumlah atau kunci permintaan penarikan tidak valid." },
        400,
      );
    }

    const existingRows = await adminRequest<Withdrawal[]>(
      `seller_withdrawals?select=id,seller_id,amount,provider,account_number,recipient_name,provider_reference,status&seller_id=eq.${user.id}&status=eq.processing&provider_reference=is.null&order=created_at.desc&limit=1`,
    );
    const existing = existingRows[0];
    if (existing) {
      if (Number(existing.amount) !== body.amount) {
        return jsonResponse(
          { error: "Penarikan sebelumnya masih diproses. Periksa statusnya dahulu." },
          409,
        );
      }
      withdrawal = existing;
    } else {
      const result = await adminRequest<Withdrawal | Withdrawal[]>(
        "rpc/reserve_seller_withdrawal",
        {
          method: "POST",
          body: JSON.stringify({
            p_seller_id: user.id,
            p_amount: body.amount,
            p_idempotency_key: body.idempotencyKey,
          }),
        },
      );
      withdrawal = Array.isArray(result) ? result[0] : result;
    }
    if (!withdrawal) {
      throw new Error("Server tidak mengembalikan permintaan penarikan.");
    }
    if (withdrawal.status !== "processing" || withdrawal.provider_reference) {
      return jsonResponse({
        withdrawalId: withdrawal.id,
        status: withdrawal.status,
        message: "Permintaan penarikan sudah tercatat.",
      });
    }

    const email = user.email ?? null;
    try {
      const result =
        withdrawal.provider === "OVO" || withdrawal.provider === "GoPay"
          ? await sendMidtransPayout(withdrawal, email)
          : await sendXenditPayout(withdrawal, email);
      await updateWithdrawal(
        withdrawal.id,
        result.reference,
        result.status,
      );
      return jsonResponse({
        withdrawalId: withdrawal.id,
        status: result.status,
        message:
          result.status === "completed"
            ? "Penarikan berhasil."
            : "Penarikan sedang diproses oleh penyedia pembayaran.",
      });
    } catch (providerError) {
      const message =
        providerError instanceof Error
          ? providerError.message
          : "Penyedia pembayaran menolak permintaan.";
      await updateWithdrawal(withdrawal.id, null, "failed", message);
      throw providerError;
    }
  } catch (error) {
    return errorResponse(error, "Penarikan saldo belum dapat diproses.");
  }
});
