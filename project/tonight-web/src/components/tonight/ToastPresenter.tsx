"use client";

import { Toaster } from "react-hot-toast";

export function ToastPresenter() {
  return (
    <Toaster
      position="bottom-center"
      gutter={12}
      containerStyle={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
      }}
      toastOptions={{
        duration: 4000,
        style: {
          background: "transparent",
          boxShadow: "none",
          padding: 0,
          maxWidth: "100%",
        },
      }}
    />
  );
}

export default ToastPresenter;
