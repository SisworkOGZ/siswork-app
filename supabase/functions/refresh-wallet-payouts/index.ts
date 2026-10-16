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
  provider_reference: string | null;
  status: "processing" | "completed" | "failed";
};

async function setStatus(
  withdrawal: Withdrawal,
  status: Withdrawal["status"],
  failureReason: string | null = null,
) {
  return adminRequest(
    "rpc/update_seller_withdrawal",
    {
      method: "POST",
      body: JSON.stringify({
        p_withdrawal_id: withdrawal.id,
        p_provider_reference: withdrawal.provider_reference,
        p_status: status,
        p_failure_reason: failureReason,
      }),
    },
  );
}

Deno.serve(async (request: Request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method tidak didukung." }, 405);
  }

  try {
    const user = await getAuthenticatedUser(request);
    const withdrawals = await adminRequest<Withdrawal[]>(
      `seller_withdrawals?select=id,seller_id,amount,provider,provider_reference,status&seller_id=eq.${user.id}&status=eq.processing&order=created_at.desc&limit=25`,
    );
    const production = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true";
    for (const withdrawal of withdrawals) {
      if (!withdrawal.provider_reference) continue;

      if (withdrawal.provider === "OVO" || withdrawal.provider === "GoPay") {
        const apiKey = Deno.env.get("MIDTRANS_PAYOUT_API_KEY");
        if (!apiKey) {
          throw new Error("MIDTRANS_PAYOUT_API_KEY belum diatur.");
        }
        const baseUrl = production
          ? "https://app.midtrans.com/iris/api/v1"
          : "https://app.sandbox.midtrans.com/iris/api/v1";
        const response = await fetch(
          `${baseUrl}/payouts/${encodeURIComponent(withdrawal.provider_reference)}`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Basic ${btoa(`${apiKey}:`)}`,
            },
          },
        );
        const result = (await response.json()) as {
          status?: string;
          error_message?: string;
        };
        if (!response.ok) {
          throw new Error(
            result.error_message ??
              `Midtrans gagal memeriksa payout (${response.status}).`,
          );
        }
        const status =
          result.status === "completed"
            ? "completed"
            : result.status === "failed"
              ? "failed"
              : "processing";
        if (status !== "processing") {
          await setStatus(
            withdrawal,
            status,
            status === "failed" ? "Payout Midtrans gagal." : null,
          );
        }
      } else {
        const secretKey = Deno.env.get("XENDIT_SECRET_KEY");
        if (!secretKey) throw new Error("XENDIT_SECRET_KEY belum diatur.");
        const response = await fetch(
          `https://api.xendit.co/v3/payouts/${encodeURIComponent(withdrawal.provider_reference)}`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Basic ${btoa(`${secretKey}:`)}`,
              "Api-version": "2025-09-01",
            },
          },
        );
        const result = (await response.json()) as {
          status?: string;
          message?: string;
        };
        if (!response.ok) {
          throw new Error(
            result.message ??
              `Xendit gagal memeriksa payout (${response.status}).`,
          );
        }
        const status =
          result.status === "SUCCEEDED"
            ? "completed"
            : result.status === "FAILED" || result.status === "REVERSED"
              ? "failed"
              : "processing";
        if (status !== "processing") {
          await setStatus(
            withdrawal,
            status,
            status === "failed" ? "Payout Xendit gagal." : null,
          );
        }
      }
    }
    return jsonResponse({ refreshed: withdrawals.length });
  } catch (error) {
    return errorResponse(error, "Status penarikan belum dapat diperbarui.");
  }
});
