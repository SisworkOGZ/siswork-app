import {
  adminRequest,
  errorResponse,
  handleOptions,
  jsonResponse,
  toHex,
} from "../_shared/http.ts";

type Payment = {
  id: string;
  project_id: string;
  seller_id: string;
  amount: number;
  status: string;
};

type MidtransNotification = {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  transaction_status?: string;
  fraud_status?: string;
  transaction_id?: string;
  signature_key?: string;
};

async function verifySignature(
  notification: MidtransNotification,
  serverKey: string,
): Promise<boolean> {
  if (
    !notification.order_id ||
    !notification.status_code ||
    !notification.gross_amount ||
    !notification.signature_key
  ) {
    return false;
  }
  const signature = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(
      `${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`,
    ),
  );
  const expected = toHex(signature);
  if (expected.length !== notification.signature_key.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |=
      expected.charCodeAt(index) ^ notification.signature_key.charCodeAt(index);
  }
  return difference === 0;
}

Deno.serve(async (request: Request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method tidak didukung." }, 405);
  }

  try {
    const notification =
      (await request.json()) as MidtransNotification;
    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY");
    if (!serverKey || !(await verifySignature(notification, serverKey))) {
      return jsonResponse({ error: "Signature not valid." }, 401);
    }

    const rows = await adminRequest<Payment[]>(
      `project_payments?select=id,project_id,seller_id,amount,status&order_id=eq.${encodeURIComponent(notification.order_id!)}&limit=1`,
    );
    const payment = rows[0];
    if (!payment) return jsonResponse({ error: "Payment not found." }, 404);
    if (Number(notification.gross_amount) !== Number(payment.amount)) {
      return jsonResponse({ error: "Amount mismatch." }, 400);
    }

    const transactionStatus = notification.transaction_status;
    const paid =
      transactionStatus === "settlement" ||
      (transactionStatus === "capture" && notification.fraud_status === "accept");
    const failed = ["deny", "cancel", "expire"].includes(
      transactionStatus ?? "",
    );
    const refunded = ["refund", "partial_refund", "chargeback"].includes(
      transactionStatus ?? "",
    );

    if (!paid && !failed && !refunded) {
      return jsonResponse({ received: true });
    }
    if (payment.status === "refunded" || (payment.status === "paid" && !refunded)) {
      return jsonResponse({ received: true });
    }

    const status = refunded ? "refunded" : paid ? "paid" : "failed";
    if (refunded && payment.status === "paid") {
      await adminRequest("seller_wallet_transactions", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({
          seller_id: payment.seller_id,
          amount: -Number(payment.amount),
          payment_id: payment.id,
          description: "Pembalikan saldo karena transaksi pembayaran dikembalikan",
        }),
      });
    }
    await adminRequest(`project_payments?id=eq.${payment.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        provider_transaction_id: notification.transaction_id ?? null,
        paid_at: paid ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }),
    });
    await adminRequest(`projects?id=eq.${payment.project_id}`, {
      method: "PATCH",
      body: JSON.stringify({
        payment_status: status === "paid" ? "paid" : status,
      }),
    });

    return jsonResponse({ received: true });
  } catch (error) {
    return errorResponse(error, "Notification pembayaran belum diproses.");
  }
});
