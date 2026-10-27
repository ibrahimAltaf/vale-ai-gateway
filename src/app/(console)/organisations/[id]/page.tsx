import { Suspense } from "react";

import { OrganisationDetail } from "@/features/tenants/organisation-detail";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OrganisationDetail />
    </Suspense>
  );
}
