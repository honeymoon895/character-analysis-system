"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { KnowledgePanel } from "@/components/knowledge/KnowledgePanel";
import { SubPageHeader } from "@/components/me/SubPageHeader";

export default function KnowledgePage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) router.push("/login");
  }, []);

  return (
    <div className="shell pt-6 md:pt-10 pb-10 max-w-2xl">
      <SubPageHeader
        title="知识库"
        en="Memory"
        desc="关于你的一切原料：日记、想法、关系、决定。自我认知和模拟人生都从这里取依据。"
      />
      <div className="rise">
        <KnowledgePanel />
      </div>
    </div>
  );
}
