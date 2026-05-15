export const LOGIN_URL = "https://api.swapfaces.ai/api/account/login";
export const DETAIL_URL = "https://api.swapfaces.ai/api/account/detail?website=swapfaces";
export const IMAGE_TO_IMAGE_URL = "https://api.swapfaces.ai/api/image/image-to-image";
export const ACTION_HISTORY_URL = "https://api.swapfaces.ai/api/account/action/history";
export const UPLOAD_PRESIGN_URL = "https://api.swapfaces.ai/api/upload/presign";
export const UNLIMIT_FACE_SWAPPER_DETECT_URL =
  "https://api.swapfaces.ai/api/image/unlimit-face-swapper/detect";
export const UNLIMIT_FACE_SWAPPER_SWAP_URL =
  "https://api.swapfaces.ai/api/image/unlimit-face-swapper/swap";
export const ACTION_INFO_URL = "https://api.swapfaces.ai/api/action/info";

export const DEFAULT_DEVICE = {
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0",
  lang: "en-US",
  platform: "MacIntel",
  screenWidth: 1440,
  screenHeight: 900,
  screenColorDepth: 30,
  screenPixelDepth: 30,
  audioFingerprint: 35.749972093850374
};

export const DEFAULT_LOGIN_PAYLOAD = {
  platform: "guest",
  device: DEFAULT_DEVICE,
  website: "swapfaces"
};
