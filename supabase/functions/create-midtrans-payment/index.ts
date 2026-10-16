import {
  adminRequest,
  errorResponse,
  getAuthenticatedUser,
  handleOptions,
  jsonResponse,
} from "../_shared/http.ts";

type Project = {
  id: string;
  buyer_id: string;
  seller_id: string;
  title: string;
  description: string | null;
  amount: number;
  status: string;
  payment_status: string;
};

type Payment = {
  id: string;
  project_id: string;
  order_id: string;
  amount: number;
  status: string;
  redirect_url: string | null;
};

Deno.serve(async (request: Request) => {
  const options = handleOptions(request);
  if (options) return options;
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method tidak didukung." }, 405);
  }

  try {
    const user = await getAuthenticatedUser(request);
    const body = (await request.json()) as { projectId?: string };
    if (!body.projectId || !/^[0-9a-f-]{36}$/i.test(body.projectId)) {
      return jsonResponse({ error: "ID proyek tidak valid." }, 400);
    }

    const projects = await adminRequest<Project[]>(
      `projects?select=id,buyer_id,seller_id,title,description,amount,status,payment_status&id=eq.${body.projectId}&limit=1`,
    );
    const project = projects[0];
    if (!project || project.buyer_id !== user.id) {
      return jsonResponse({ error: "Proyek tidak ditemukan." }, 404);
    }
    if (project.status === "completed") {
      return jsonResponse({ error: "Proyek ini sudah selesai." }, 409);
    }
    if (project.payment_status === "not_required") {
      return jsonResponse(
        { error: "Invoice lama ini tidak memiliki pembayaran dalam aplikasi." },
        409,
      );
    }
    if (project.payment_status === "paid") {
      return jsonResponse({ error: "Invoice ini sudah dibayar." }, 409);
    }

    const amount = Number(project.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return jsonResponse(
        { error: "Nilai invoice harus berupa nominal Rupiah bulat di atas nol." },
        400,
      );
    }

    const existingPayments = await adminRequest<Payment[]>(
      `project_payments?select=id,project_id,order_id,amount,status,redirect_url&project_id=eq.${project.id}&status=eq.pending&order=created_at.desc&limit=1`,
    );
    const existingPayment = existingPayments[0];
    if (existingPayment?.redirect_url) {
      return jsonResponse({
        redirectUrl: existingPayment.redirect_url,
        paymentId: existingPayment.id,
      });
    }
    if (existingPayment) {
      return jsonResponse(
        { error: "Pembayaran sedang disiapkan. Coba lagi sebentar." },
        409,
      );
    }

    const paymentRows = await adminRequest<Payment[]>(
      "project_payments",
      {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          project_id: project.id,
          buyer_id: project.buyer_id,
          seller_id: project.seller_id,
          order_id: `siswork-${crypto.randomUUID()}`,
          idempotency_key: crypto.randomUUID(),
          amount,
          status: "pending",
        }),
      },
    );
    const payment = paymentRows[0];
    if (!payment) throw new Error("Server tidak membuat data pembayaran.");

    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY");
    if (!serverKey) {
      await adminRequest(
        `project_payments?id=eq.${payment.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "failed" }),
        },
      );
      throw new Error("MIDTRANS_SERVER_KEY belum diatur pada Supabase Secrets.");
    }

    const production = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true";
    const midtransUrl = production
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";
    const snapResponse = await fetch(midtransUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${btoa(`${serverKey}:`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: payment.order_id,
          gross_amount: amount,
        },
        item_details: [
          {
            id: project.id,
            price: amount,
            quantity: 1,
            name: project.title.slice(0, 50),
          },
        ],
        customer_details: {
          first_name: user.email?.split("@")[0]?.slice(0, 50) || "Pelajar",
          email: user.email,
        },
      }),
    });
    const snapResult = (await snapResponse.json()) as {
      token?: string;
      redirect_url?: string;
      error_messages?: string[];
    };
    if (
      !snapResponse.ok ||
      !snapResult.token ||
      !snapResult.redirect_url
    ) {
      await adminRequest(`project_payments?id=eq.${payment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "failed" }),
      });
      throw new Error(
        snapResult.error_messages?.join(" ") ||
          `Midtrans tidak dapat membuat transaksi (${snapResponse.status}).`,
      );
    }

    await adminRequest(`project_payments?id=eq.${payment.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        snap_token: snapResult.token,
        redirect_url: snapResult.redirect_url,
        updated_at: new Date().toISOString(),
      }),
    });
    await adminRequest(`projects?id=eq.${project.id}`, {
      method: "PATCH",
      body: JSON.stringify({ payment_status: "pending" }),
    });

    return jsonResponse({
      redirectUrl: snapResult.redirect_url,
      paymentId: payment.id,
    });
  } catch (error) {
    return errorResponse(error, "Pembayaran belum dapat dimulai.");
  }
});
