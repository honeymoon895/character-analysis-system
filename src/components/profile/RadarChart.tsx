"use client";

import { useEffect, useRef } from "react";

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
 * 2. 置信度用外圈虚线表示：虚线越短，这个方向的结论越不可靠。
 */

export function RadarChart({ data }: { data: DimensionData[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  const measured = data.filter((d) => d.measured !== false && d.score > 0);

  useEffect(() => {
    if (typeof window === "undefined" || measured.length < 3) return;
    let disposed = false;

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
          backgroundColor: "rgba(16,19,24,0.96)",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
          padding: [10, 12],
          textStyle: { color: "#e9e4da", fontSize: 12 },
          formatter: (p: any) => {
            const d = measured[p.dataIndex];
            if (!d) return "";
            return `<div style="font-weight:600;margin-bottom:4px">${d.name}</div>
              <div style="color:#b3ac9d">得分 <span style="color:#edc07a;font-weight:600">${d.score}</span> · 置信 ${d.confidence}%</div>`;
          },
        },
        radar: {
          indicator,
          center: ["50%", "52%"],
          radius: "66%",
          shape: "polygon",
          splitNumber: 4,
          axisName: {
            color: "#8f887a",
            fontSize: 11,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif',
          },
          splitLine: {
            lineStyle: { color: "rgba(255,255,255,0.07)" },
          },
          splitArea: {
            areaStyle: {
              color: ["rgba(255,255,255,0.012)", "rgba(255,255,255,0.03)"],
            },
          },
          axisLine: {
            lineStyle: { color: "rgba(255,255,255,0.08)" },
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
                      { offset: 0, color: "rgba(237,192,122,0.22)" },
                      { offset: 1, color: "rgba(217,167,92,0.06)" },
                    ],
                  },
                },
                lineStyle: { color: "#d9a75c", width: 1.8 },
                itemStyle: {
                  color: "#edc07a",
                  borderColor: "#0b0d11",
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
  }, [measured.map((d) => `${d.code}:${d.score}`).join(",")]);

  if (measured.length < 3) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center mb-3">
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
