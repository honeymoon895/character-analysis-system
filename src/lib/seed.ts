import { prisma } from "./db";

async function seed() {
  const dimensions = [
    {
      code: "OPENNESS",
      name: "开放性",
      description: "反映个体对新事物、新体验的开放程度",
      highLabel: "好奇宝宝、探索者",
      mediumLabel: "愿意尝试",
      lowLabel: "恋旧、固守",
    },
    {
      code: "CONSCIENTIOUSNESS",
      name: "尽责性",
      description: "反映个体的自律性、责任感和条理性",
      highLabel: "自律达人、井井有条",
      mediumLabel: "靠得住",
      lowLabel: "随遇而安、拖延症",
    },
    {
      code: "EXTRAVERSION",
      name: "外向性",
      description: "反映个体对外部世界的投入程度",
      highLabel: "社交达人、话匣子",
      mediumLabel: "平衡者",
      lowLabel: "独行侠、安静",
    },
    {
      code: "AGREEABLENESS",
      name: "宜人性",
      description: "反映个体在人际合作中的友善程度",
      highLabel: "温暖、善解人意",
      mediumLabel: "友好",
      lowLabel: "竞争、挑剔",
    },
    {
      code: "NEUROTICISM",
      name: "情绪稳定性",
      description: "反映个体情绪的稳定性和抗压能力",
      highLabel: "稳如泰山、抗压",
      mediumLabel: "正常人",
      lowLabel: "敏感、焦虑",
    },
    {
      code: "DECISIVENESS",
      name: "决断力",
      description: "反映个体决策的速度和果断程度",
      highLabel: "雷厉风行、果断",
      mediumLabel: "权衡者",
      lowLabel: "犹豫、纠结",
    },
    {
      code: "RISK_TENDENCY",
      name: "风险偏好",
      description: "反映个体对风险和挑战的态度",
      highLabel: "冒险家、敢闯",
      mediumLabel: "稳健",
      lowLabel: "保守、安全第一",
    },
    {
      code: "EMPATHY",
      name: "共情能力",
      description: "反映个体理解和感受他人情感的能力",
      highLabel: "知心、善倾听",
      mediumLabel: "理解",
      lowLabel: "理性、分析",
    },
    {
      code: "LEADERSHIP",
      name: "领导力",
      description: "反映个体的领导魅力和组织能力",
      highLabel: "领袖、感染力",
      mediumLabel: "组织者",
      lowLabel: "执行者",
    },
  ];

  for (const dim of dimensions) {
    await prisma.dimensionDefinition.upsert({
      where: { code: dim.code },
      update: dim,
      create: dim,
    });
  }

  console.log("✅ 维度定义已初始化");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
