import { Suspense } from "react";
import ConfigureClient from "./ConfigureClient";

export default function ConfigurePage() {
  return (
    <Suspense fallback={<div className="page-shell"><div className="mt-20 text-center text-slate-500">Loading…</div></div>}>
      <ConfigureClient />
    </Suspense>
  );
}
