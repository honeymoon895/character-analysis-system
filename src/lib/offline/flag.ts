/**
 * 运行模式开关
 *
 * NEXT_PUBLIC_OFFLINE=1 构建出来的是单机版：
 * 数据存本机、AI 从手机直连、没有登录与服务器。
 * 不设时仍是原来的云端版，两者共用同一套页面代码。
 */
export const IS_OFFLINE = process.env.NEXT_PUBLIC_OFFLINE === "1";
