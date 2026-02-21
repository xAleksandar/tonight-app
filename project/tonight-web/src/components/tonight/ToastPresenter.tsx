"use client";

import { Toaster } from "react-hot-toast";

export function ToastPresenter() {
  return (
    <Toaster
      position="top-center"
      gutter={16}
      containerClassName="!top-6 !left-0 !right-0 !flex !justify-center md:!left-64"
      containerStyle={{
        top: '24px',
      }}
      toastOptions={{
        duration: 4000,
        style: {
          background: "transparent",
          boxShadow: "none",
          padding: 0,
          margin: "0 auto",
        },
        success: {
          duration: 3200,
        },
        error: {
          duration: 5000,
        },
      }}
    />
  );
}

export default ToastPresenter;
