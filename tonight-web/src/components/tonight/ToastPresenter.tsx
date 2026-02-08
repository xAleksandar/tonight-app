"use client";

import { Toaster } from "react-hot-toast";

export function ToastPresenter() {
  return (
    <Toaster
      position="top-center"
      gutter={12}
      containerClassName="top-4 sm:top-6"
      toastOptions={{
        duration: 4000,
        style: {
          background: "transparent",
          boxShadow: "none",
          padding: 0,
        },
        success: {
          duration: 3800,
        },
        error: {
          duration: 5500,
        },
      }}
    />
  );
}

export default ToastPresenter;
