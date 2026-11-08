import type { PartnerRelation } from "../types";

interface PartnerIconProps {
  relation: PartnerRelation;
  size?: number;
  color?: string;
  title?: string;
}

/** 不同关系使用不同图标：伴侣爱心、兄弟姐妹双人、同学学士帽、朋友交叠圆环、其他单人。 */
export function PartnerIcon({
  relation,
  size = 9,
  color = "currentColor",
  title,
}: PartnerIconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    role: title ? ("img" as const) : undefined,
    "aria-hidden": title ? undefined : true,
    className: "shrink-0",
  };

  const body = (() => {
    switch (relation) {
      case "sibling":
        return (
          <>
            <circle cx="8" cy="8" r="3" fill={color} />
            <circle cx="16" cy="8" r="3" fill={color} opacity="0.55" />
            <path d="M2 21c0-3.6 2.7-6.5 6-6.5s6 2.9 6 6.5z" fill={color} />
            <path d="M10 21c0-3.6 2.7-6.5 6-6.5s6 2.9 6 6.5z" fill={color} opacity="0.55" />
          </>
        );
      case "classmate":
        return (
          <>
            <path d="M12 3 1.5 8.5 12 14l10.5-5.5L12 3z" fill={color} />
            <path
              d="M5.5 11.2v5.1c0 1.9 2.9 3.4 6.5 3.4s6.5-1.5 6.5-3.4v-5.1"
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        );
      case "friend":
        return (
          <>
            <circle cx="9" cy="12" r="5.5" fill="none" stroke={color} strokeWidth="2.2" />
            <circle cx="15" cy="12" r="5.5" fill="none" stroke={color} strokeWidth="2.2" opacity="0.6" />
          </>
        );
      case "other":
        return (
          <>
            <circle cx="12" cy="8" r="3.2" fill={color} />
            <path d="M4.8 21c0-4 3.2-7.2 7.2-7.2s7.2 3.2 7.2 7.2z" fill={color} />
          </>
        );
      case "partner":
      default:
        return (
          <path
            d="M12 21s-7.4-4.6-9.3-9A5.6 5.6 0 0 1 12 6.1 5.6 5.6 0 0 1 21.3 12C19.4 16.4 12 21 12 21z"
            fill={color}
          />
        );
    }
  })();

  return (
    <svg {...common}>
      {title ? <title>{title}</title> : null}
      {body}
    </svg>
  );
}
