import { onRequest as __ai_js_onRequest } from "C:\\Users\\marti\\OneDrive\\Documents\\Documents\\CODING\\JAVASCRIPT\\react-image-video-runwayml-main\\functions\\ai.js"
import { onRequest as __ai_copy_js_onRequest } from "C:\\Users\\marti\\OneDrive\\Documents\\Documents\\CODING\\JAVASCRIPT\\react-image-video-runwayml-main\\functions\\ai copy.js"

export const routes = [
    {
      routePath: "/ai",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [__ai_js_onRequest],
    },
  {
      routePath: "/ai copy",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [__ai_copy_js_onRequest],
    },
  ]