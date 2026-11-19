"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";

interface DimensionData {
  code: string;
  name: string;
  score: number;
  confidence: number;
  measured?: boolean;
}

/**
 * 人格轮廓图
 *
 * 与旧版的区别：
 * 1. 未测出的维度不画成 0 —— 补 0 会让"未知"看起来像"低分"，这是误导。
 *    这里改为只用已测维度绘制，并明确标注跳过了哪些。
 * 2. 颜色随主题切换：ECharts 输出到 SVG 属性里，CSS 变量在其中不一定生效，
 *    因此这里按当前主题传入具体色值，并在主题变化时重建图表。
 */

const PALETTE = {
  dark: {
    axis: "#9aa7c0",
    split: "rgba(255,255,255,0.07)",
    splitArea: ["rgba(255,255,255,0.012)", "rgba(255,255,255,0.03)"],
    axisLine: "rgba(255,255,255,0.08)",
    tipBg: "rgba(12,16,24,0.96)",
    tipBorder: "rgba(255,255,255,0.1)",
    tipFg: "#e2e8f4",
    tipSub: "#9aa7c0",
    area0: "rgba(94,240,224,0.24)",
    area1: "rgba(139,92,246,0.07)",
    line: "#2ed3c4",
    dot: "#5ef0e0",
    dotBorder: "#04060b",
  },
  light: {
    axis: "#4d5b74",
    split: "rgba(16,24,40,0.1)",
    splitArea: ["rgba(16,24,40,0.014)", "rgba(16,24,40,0.03)"],
    axisLine: "rgba(16,24,40,0.14)",
    tipBg: "rgba(255,255,255,0.98)",
    tipBorder: "rgba(16,24,40,0.12)",
    tipFg: "#1a2333",
    tipSub: "#6b7891",
    area0: "rgba(15,143,132,0.18)",
    area1: "rgba(109,67,217,0.07)",
    line: "#0f8f84",
    dot: "#14a89b",
    dotBorder: "#ffffff",
  },
} as const;

export function RadarChart({ data }: { data: DimensionData[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const { resolved } = useTheme();

  const measured = data.filter((d) => d.measured !== false && d.score > 0);

  useEffect(() => {
    if (typeof window === "undefined" || measured.length < 3) return;
    let disposed = false;
    const c = PALETTE[resolved] ?? PALETTE.dark;

    (async () => {
      const echarts = await import("echarts");
      if (!ref.current || disposed) return;

      chartRef.current?.dispose();
      const chart = echarts.init(ref.current, undefined, { renderer: "svg" });
      chartRef.current = chart;

      const indicator = measured.map((d) => ({
        name: d.name,
        max: 100,
      }));

      chart.setOption({
        backgroundColor: "transparent",
        animationDuration: 700,
        tooltip: {
          backgroundColor: c.tipBg,
          borderColor: c.tipBorder,
          borderWidth: 1,
          padding: [10, 12],
          textStyle: { color: c.tipFg, fontSize: 12 },
          formatter: (p: any) => {
            const d = measured[p.dataIndex];
            if (!d) return "";
            return `<div style="font-weight:600;margin-bottom:4px">${d.name}</div>
              <div style="color:${c.tipSub}">得分 <span style="color:${c.line};font-weight:600">${d.score}</span> · 置信 ${d.confidence}%</div>`;
          },
        },
        radar: {
          indicator,
          center: ["50%", "52%"],
          radius: "66%",
          shape: "polygon",
          splitNumber: 4,
          axisName: {
            color: c.axis,
            fontSize: 11,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
          },
          splitLine: {
            lineStyle: { color: c.split },
          },
          splitArea: {
            areaStyle: {
              color: [c.splitArea[0], c.splitArea[1]],
            },
          },
          axisLine: {
            lineStyle: { color: c.axisLine },
          },
        },
        series: [
          {
            type: "radar",
            symbolSize: 4,
            data: [
              {
                value: measured.map((d) => d.score),
                name: "人格轮廓",
                areaStyle: {
                  color: {
                    type: "radial",
                    x: 0.5,
                    y: 0.5,
                    r: 0.6,
                    colorStops: [
                      { offset: 0, color: c.area0 },
                      { offset: 1, color: c.area1 },
                    ],
                  },
                },
                lineStyle: { color: c.line, width: 1.8 },
                itemStyle: {
                  color: c.dot,
                  borderColor: c.dotBorder,
                  borderWidth: 1,
                },
              },
            ],
          },
        ],
      });
    })();

    const onResize = () => chartRef.current?.resize();
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, [measured.map((d) => `${d.code}:${d.score}`).join(","), resolved]);

  if (measured.length < 3) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-12 h-12 rounded-full border border-[var(--border-2)] flex items-center justify-center mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-bone-600" />
        </div>
        <p className="text-[12.5px] text-bone-500 leading-relaxed max-w-[240px]">
          已测出的维度不足 3 个，无法绘制轮廓。
          <br />
          补充更多具体观察可以补全。
        </p>
      </div>
    );
  }

  const skipped = data.length - measured.length;

  return (
    <div>
      <div ref={ref} style={{ width: "100%", height: 260 }} />
      {skipped > 0 && (
        <p className="text-[10.5px] text-bone-600 text-center mt-1">
          另有 {skipped} 个维度证据不足，未纳入轮廓
        </p>
      )}
    </div>
  );
}
