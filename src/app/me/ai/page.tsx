"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { AISettingsPanel } from "@/components/settings/AISettingsPanel";
import { SubPageHeader } from "@/components/me/SubPageHeader";

export default function AIEnginePage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) router.push("/login");
  }, []);

  return (
    <div className="shell pt-6 md:pt-10 pb-10 max-w-2xl">
      <SubPageHeader
        title="AI 引擎"
        en="Engine"
        desc="选择服务商并填写你自己的密钥。对话、画像、视频可分别指定模型。"
      />
      <div className="rise">
        <AISettingsPanel />
      </div>
    </div>
  );
}
