"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { feesApi, parentsApi } from "@/lib/api";
import { formatCurrency, formatDate, feeStatusColor } from "@/lib/utils";
import { useToast } from "@/components/ui/toaster";
import {
  DollarSign, CreditCard, CheckCircle, AlertTriangle,
  Clock, Loader2, ExternalLink, Receipt,
} from "lucide-react";

const FEE_TYPE_LABELS: Record<string, string> = {
  TUITION: "Tuition Fee", TRANSPORT: "Transport Fee", LIBRARY: "Library Fee",
  EXAM: "Exam Fee", ACTIVITY: "Activity Fee", UNIFORM: "Uniform Fee", OTHER: "Other",
};

export default function ParentFeesPage() {
  const { success, error } = useToast();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: children } = useQuery({
    queryKey: ["parent-children"],
    queryFn: () => parentsApi.myChildren().then((r) => r.data.data),
  });

  const firstChild = children?.[0]?.student;

  const { data: feesData, isLoading } = useQuery({
    queryKey: ["parent-fees-full", firstChild?.id, filterStatus],
    queryFn: () =>
      feesApi.list({
        studentId: firstChild!.id,
        limit: 50,
        ...(filterStatus !== "all" && { status: filterStatus }),
      }).then((r) => r.data),
    enabled: !!firstChild?.id,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (feeId: string) => {
      // First create an invoice, then checkout
      const invoiceRes = await feesApi.createInvoice(feeId);
      const invoiceId = invoiceRes.data.data.id;
      const checkoutRes = await feesApi.checkout(invoiceId);
      return checkoutRes.data.data;
    },
    onSuccess: (data) => {
      if (data.sessionUrl) {
        window.open(data.sessionUrl, "_blank");
        success("Redirecting to payment", "A new tab has opened for secure payment");
      }
      setPayingId(null);
    },
    onError: () => {
      error("Payment failed", "Could not initiate payment. Please try again.");
      setPayingId(null);
    },
  });

  const fees = feesData?.data ?? [];
  const meta = feesData?.meta;

  const totals = fees.reduce(
    (acc: any, f: any) => {
      acc.total += Number(f.amount);
      if (["PENDING", "OVERDUE"].includes(f.status)) acc.outstanding += Number(f.amount);
      if (f.status === "PAID") acc.paid += Number(f.amount);
      if (f.status === "OVERDUE") acc.overdue += Number(f.amount);
      return acc;
    },
    { total: 0, outstanding: 0, paid: 0, overdue: 0 }
  );

  return (
    <DashboardLayout allowedRoles={["PARENT"]}>
      <div className="space-y-6">
        <div>
          <h1>Fee Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            View and pay fees for{" "}
            <span className="font-medium text-foreground">
              {firstChild?.user?.firstName} {firstChild?.user?.lastName}
            </span>
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Fees", value: formatCurrency(totals.total), icon: DollarSign, color: "bg-blue-100 text-blue-700" },
            { label: "Outstanding", value: formatCurrency(totals.outstanding), icon: Clock, color: totals.outstanding > 0 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700" },
            { label: "Overdue", value: formatCurrency(totals.overdue), icon: AlertTriangle, color: totals.overdue > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700" },
            { label: "Paid", value: formatCurrency(totals.paid), icon: CheckCircle, color: "bg-green-100 text-green-700" },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 border-b">
          {[
            { value: "all", label: "All" },
            { value: "PENDING", label: "Pending" },
            { value: "OVERDUE", label: "Overdue" },
            { value: "PAID", label: "Paid" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilterStatus(f.value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                filterStatus === f.value
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Fees list */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : fees.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed bg-card p-16 text-center text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No {filterStatus !== "all" ? filterStatus.toLowerCase() : ""} fees found</p>
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Due Date</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {fees.map((fee: any) => {
                  const isPayable = ["PENDING", "OVERDUE"].includes(fee.status);
                  const isPaying = payingId === fee.id && checkoutMutation.isPending;

                  return (
                    <tr key={fee.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{fee.description}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">{FEE_TYPE_LABELS[fee.type] ?? fee.type}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {FEE_TYPE_LABELS[fee.type] ?? fee.type}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={fee.status === "OVERDUE" ? "text-red-600 font-medium" : "text-muted-foreground"}>
                          {formatDate(fee.dueDate)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatCurrency(Number(fee.amount))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${feeStatusColor(fee.status)}`}>
                          {fee.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isPayable ? (
                          <button
                            onClick={() => { setPayingId(fee.id); checkoutMutation.mutate(fee.id); }}
                            disabled={isPaying || checkoutMutation.isPending}
                            className="flex items-center gap-1.5 ml-auto rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                          >
                            {isPaying ? <><Loader2 className="h-3 w-3 animate-spin" />Processing</> : <><CreditCard className="h-3 w-3" />Pay Now</>}
                          </button>
                        ) : (
                          <button className="flex items-center gap-1 ml-auto text-xs text-muted-foreground hover:text-foreground">
                            <Receipt className="h-3 w-3" /> Receipt
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {fees.length > 0 && (
                <tfoot className="border-t bg-muted/30">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm font-semibold hidden md:table-cell">Total Outstanding</td>
                    <td colSpan={1} className="px-4 py-3 text-sm font-semibold md:hidden">Outstanding</td>
                    <td className="px-4 py-3 text-right font-bold text-lg">{formatCurrency(totals.outstanding)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Payment info */}
        <div className="rounded-xl border bg-blue-50 border-blue-100 p-4 flex items-start gap-3">
          <CreditCard className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold">Secure Online Payment</p>
            <p className="mt-0.5 opacity-80">Payments are processed securely via Stripe. Cards are never stored on our servers. You will be redirected to a secure checkout page.</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
