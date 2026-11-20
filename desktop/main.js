/**
 * 读心术 · 桌面版（Windows / macOS）
 *
 * 内容就是单机版的静态导出，数据存在本机（Electron 的 IndexedDB），
 * 只有调用 AI 时联网。没有服务器，也不需要备案。
 */
const { app, BrowserWindow, protocol, net, session, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { resolveRequest } = require("./resolve");

const SCHEME = "app";
const HOST = "local";
const START_URL = `${SCHEME}://${HOST}/`;

// 打包后静态文件在 resources/web；开发时直接读仓库里的 out/
const WEB_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, "web")
  : path.join(__dirname, "..", "out");

/*
 * 自定义协议而不是 file://：
 * 1. Next 产物里全是 /_next/... 这类绝对路径，file:// 下会解析到磁盘根目录
 * 2. standard + secure 让 IndexedDB / localStorage / fetch 都按普通 https 站点工作，
 *    数据才能稳定持久化
 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

/*
 * 跨域放行：
 * 手机端靠 CapacitorHttp 绕开跨域，桌面端这里给 AI 接口的响应补上 CORS 头。
 * 有些服务商（如智谱）不允许浏览器直连，不补的话桌面版就用不了它们。
 * 只改响应头，不读取、不转发任何内容。
 */
function allowCrossOrigin() {
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["https://*/*", "http://*/*"] },
    (details, callback) => {
      const headers = {};
      for (const [k, v] of Object.entries(details.responseHeaders || {})) {
        if (!k.toLowerCase().startsWith("access-control-")) headers[k] = v;
      }
      headers["Access-Control-Allow-Origin"] = ["*"];
      headers["Access-Control-Allow-Methods"] = ["GET, POST, PUT, PATCH, DELETE, OPTIONS"];
      // 通配符 * 不覆盖 Authorization，必须显式列出
      headers["Access-Control-Allow-Headers"] = [
        "Authorization, Content-Type, Accept, X-Requested-With",
      ];

      const result = { responseHeaders: headers };
      // 预检请求被服务商拒绝（4xx）时，改成 200 让真正的请求能发出去
      if (details.method === "OPTIONS") {
        result.statusLine = "HTTP/1.1 200 OK";
      }
      callback(result);
    }
  );
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    minHeight: 600,
    title: "读心术",
    backgroundColor: "#04060b",
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.once("ready-to-show", () => win.show());

  // 外部链接（服务商官网、图片原图）交给系统浏览器，不在应用里开新窗口
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(START_URL)) shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(START_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.loadURL(START_URL);
}

// 只允许一个实例：重复双击时聚焦已有窗口
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    if (process.platform === "win32") {
      app.setAppUserModelId("com.mindscape.app");
    }

    protocol.handle(SCHEME, (request) => {
      const { file, status } = resolveRequest(WEB_ROOT, request.url);
      if (status === 200) return net.fetch(pathToFileURL(file).toString());
      return net
        .fetch(pathToFileURL(file).toString())
        .then(
          (res) =>
            new Response(res.body, {
              status: 404,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            })
        )
        .catch(() => new Response("Not Found", { status: 404 }));
    });

    allowCrossOrigin();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
