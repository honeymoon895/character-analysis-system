"use client";

import { useEffect, useRef } from "react";

interface DimensionData {
  code: string;
  name: string;
  score: number;
  confidence: number;
}

interface RadarChartProps {
  data: DimensionData[];
  width?: number;
  height?: number;
}

export function RadarChart({ data, width = 400, height = 400 }: RadarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!data || data.length === 0) return;

    let disposed = false;

    const initChart = async () => {
      const echarts = await import("echarts");
      if (!containerRef.current || disposed) return;

      if (chartRef.current) {
        chartRef.current.dispose();
      }

      chartRef.current = echarts.init(containerRef.current);

      const indicator = data.map((d) => ({
        name: d.name,
        max: 100,
      }));

      const values = data.map((d) => d.score);

      chartRef.current?.setOption({
        tooltip: {
          trigger: "item",
          formatter: (params: any) => {
            const idx = params.dataIndex;
            const d = data[idx];
            return `<div style="font-size:14px;font-weight:600;margin-bottom:4px">${d.name}</div>
              <div>评分: <strong>${d.score}</strong>/100</div>
              <div>置信度: ${d.confidence}%</div>`;
          },
        },
        radar: {
          indicator,
          center: ["50%", "50%"],
          radius: "65%",
          shape: "polygon",
          splitNumber: 4,
          axisName: {
            color: "#6b7280",
            fontSize: 12,
          },
          splitLine: {
            lineStyle: {
              color: "rgba(108, 99, 255, 0.1)",
            },
          },
          splitArea: {
            areaStyle: {
              color: ["rgba(108, 99, 255, 0.02)", "rgba(108, 99, 255, 0.05)"],
            },
          },
          axisLine: {
            lineStyle: {
              color: "rgba(108, 99, 255, 0.2)",
            },
          },
        },
        series: [
          {
            type: "radar",
            data: [
              {
                value: values,
                name: "性格特征",
                areaStyle: {
                  color: "rgba(108, 99, 255, 0.2)",
                },
                lineStyle: {
                  color: "#6c63ff",
                  width: 2,
                },
                itemStyle: {
                  color: "#6c63ff",
                },
              },
            ],
          },
        ],
      });
    };

    initChart();

    const handleResize = () => chartRef.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", handleResize);
      chartRef.current?.dispose();
    };
  }, [data]);

  return (
    <div className="relative">
      <div ref={containerRef} style={{ width: "100%", height: `${height}px` }} />
      <div className="flex flex-wrap gap-2 mt-3 justify-center">
        {data.map((d) => (
          <div key={d.code} className="text-xs text-gray-500 flex items-center gap-1">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                d.confidence >= 70
                  ? "bg-green-400"
                  : d.confidence >= 40
                  ? "bg-yellow-400"
                  : "bg-red-400"
              }`}
            />
            {d.name}: {d.score}分
          </div>
        ))}
      </div>
    </div>
  );
}
