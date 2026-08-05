"use client";

export default function MessengerWidget() {
  return (
    <a
      href="https://m.me/hassan.darwish.abu.ali"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contact us on Messenger"
      title="Chat with us on Messenger"
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 9999,
        width: "56px",
        height: "56px",
        borderRadius: "50%",
        background: "linear-gradient(135deg, #00B2FF 0%, #006AFF 60%, #a033ff 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 20px rgba(0,178,255,0.45), 0 2px 8px rgba(0,0,0,0.35)",
        cursor: "pointer",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        textDecoration: "none",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.1)";
        (e.currentTarget as HTMLAnchorElement).style.boxShadow =
          "0 6px 28px rgba(0,178,255,0.6), 0 3px 12px rgba(0,0,0,0.4)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1)";
        (e.currentTarget as HTMLAnchorElement).style.boxShadow =
          "0 4px 20px rgba(0,178,255,0.45), 0 2px 8px rgba(0,0,0,0.35)";
      }}
    >
      {/* Messenger M logo */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 36 36"
        width="30"
        height="30"
        fill="white"
      >
        <path d="M18 2C9.164 2 2 8.72 2 17c0 4.5 1.9 8.54 4.98 11.38.26.24.42.57.43.93l.09 2.9a1.5 1.5 0 0 0 2.1 1.34l3.23-1.43c.27-.12.57-.14.85-.06A18.8 18.8 0 0 0 18 32c8.836 0 16-6.72 16-15S26.836 2 18 2Zm9.29 11.7-4.7 7.44a2.5 2.5 0 0 1-3.6.67l-3.74-2.8a1 1 0 0 0-1.2 0l-5.05 3.83c-.67.51-1.55-.28-1.08-1l4.7-7.44a2.5 2.5 0 0 1 3.6-.67l3.74 2.8a1 1 0 0 0 1.2 0l5.05-3.83c.67-.51 1.55.28 1.08 1Z" />
      </svg>
    </a>
  );
}
