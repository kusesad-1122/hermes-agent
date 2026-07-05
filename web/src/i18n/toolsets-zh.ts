// Chinese labels + descriptions for the built-in toolsets shown on the Skills
// page ("工具集" view). Keyed by the stable toolset name (ts.name), NOT the
// English label, so it survives label wording tweaks. Mirrors the backend
// registry in hermes_cli/tools_config.py (CONFIGURABLE_TOOLSETS). Toolsets not
// listed here (e.g. plugin-provided ones) fall back to the raw English label.
//
// This is a display-only overlay: the toolset's internal name/keys are never
// touched, so enable/disable + config logic is unchanged.

export interface ToolsetZh {
  label: string;
  description: string;
}

export const TOOLSETS_ZH: Record<string, ToolsetZh> = {
  web: { label: "网络搜索与抓取", description: "网页搜索、网页提取" },
  browser: { label: "浏览器自动化", description: "导航、点击、输入、滚动" },
  terminal: { label: "终端与进程", description: "终端、进程" },
  file: { label: "文件操作", description: "读取、写入、修补、搜索" },
  code_execution: { label: "代码执行", description: "执行代码" },
  vision: { label: "视觉 / 图像分析", description: "图像识别与分析" },
  video: { label: "视频分析", description: "视频分析(需支持视频的模型)" },
  image_gen: { label: "图像生成", description: "生成图像" },
  video_gen: { label: "视频生成", description: "生成视频(文本/图像/参考图)" },
  x_search: {
    label: "X(推特)搜索",
    description: "X 搜索(需 xAI OAuth 或 XAI_API_KEY)",
  },
  tts: { label: "文字转语音", description: "文字转语音" },
  skills: { label: "技能", description: "列出、查看、管理" },
  todo: { label: "任务规划", description: "待办清单" },
  memory: { label: "记忆", description: "跨会话的持久记忆" },
  context_engine: {
    label: "上下文引擎",
    description: "来自当前上下文引擎的运行时工具",
  },
  session_search: { label: "会话搜索", description: "搜索历史对话" },
  clarify: { label: "澄清提问", description: "向你追问以澄清需求" },
  delegation: { label: "任务委派", description: "委派任务给子智能体" },
  cronjob: {
    label: "定时任务",
    description: "创建/列出/更新/暂停/恢复/运行,可附加技能",
  },
  homeassistant: { label: "Home Assistant 智能家居", description: "智能家居设备控制" },
  spotify: { label: "Spotify", description: "播放、搜索、播放列表、音乐库" },
  discord: {
    label: "Discord(读取 / 参与)",
    description: "获取消息、搜索成员、创建话题",
  },
  discord_admin: {
    label: "Discord 服务器管理",
    description: "列出频道 / 身份组、置顶、分配身份组",
  },
  yuanbao: { label: "元宝", description: "群信息、成员查询、私信" },
  computer_use: {
    label: "电脑操控(macOS/Windows/Linux)",
    description: "通过 cua-driver 后台控制桌面",
  },
};
