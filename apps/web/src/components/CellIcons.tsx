interface IconProps {
  size?: number;
}

const S = 16; // default icon size

export function GoIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#27ae60" opacity="0.85" />
      <path d="M10 7l6 5-6 5V7z" fill="#fff" />
    </svg>
  );
}

export function JailIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="#7f8c8d" opacity="0.8" />
      <line x1="8" y1="5" x2="8" y2="19" stroke="#fff" strokeWidth="1.5" />
      <line x1="12" y1="5" x2="12" y2="19" stroke="#fff" strokeWidth="1.5" />
      <line x1="16" y1="5" x2="16" y2="19" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

export function FreeParkingIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#3498db" opacity="0.8" />
      <text x="12" y="16" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold" fontFamily="Inter, sans-serif">P</text>
    </svg>
  );
}

export function GoToJailIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#c0392b" opacity="0.85" />
      <path d="M8 8h8v8H8z" fill="none" stroke="#fff" strokeWidth="1.5" />
      <line x1="11" y1="10" x2="11" y2="14" stroke="#fff" strokeWidth="1.2" />
      <line x1="13" y1="10" x2="13" y2="14" stroke="#fff" strokeWidth="1.2" />
      <path d="M4 18l3-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 18l2 0" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 18l0-2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function RailroadIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="12" rx="3" fill="#6d4c2f" opacity="0.85" />
      <circle cx="8" cy="16" r="2" fill="#fff" opacity="0.8" />
      <circle cx="16" cy="16" r="2" fill="#fff" opacity="0.8" />
      <rect x="6" y="8" width="12" height="5" rx="1.5" fill="#fff" opacity="0.3" />
      <rect x="10" y="4" width="4" height="3" rx="1" fill="#6d4c2f" opacity="0.85" />
      <circle cx="12" cy="5" r="0.8" fill="#fff" opacity="0.6" />
    </svg>
  );
}

export function ElectricIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#f39c12" opacity="0.85" />
      <path d="M13 3l-4 10h4l-2 8 6-11h-5l3-7z" fill="#fff" />
    </svg>
  );
}

export function WaterIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#2980b9" opacity="0.85" />
      <path d="M12 5c0 0-5 6-5 9a5 5 0 0010 0c0-3-5-9-5-9z" fill="#fff" opacity="0.9" />
    </svg>
  );
}

export function TaxIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#c0392b" opacity="0.8" />
      <text x="12" y="16" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold" fontFamily="Inter, sans-serif">$</text>
    </svg>
  );
}

export function ChanceIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="2" width="18" height="20" rx="2" fill="#e67e22" opacity="0.85" />
      <text x="12" y="17" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold" fontFamily="serif">?</text>
    </svg>
  );
}

export function CommunityChestIcon({ size = S }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="8" width="16" height="11" rx="2" fill="#2471a3" opacity="0.85" />
      <path d="M4 11h16" stroke="#fff" strokeWidth="1" opacity="0.5" />
      <rect x="6" y="4" width="12" height="5" rx="2" fill="#2471a3" opacity="0.7" />
      <rect x="10" y="12" width="4" height="3" rx="0.5" fill="#f1c40f" opacity="0.8" />
    </svg>
  );
}

export function getCellIcon(type: string, name: string, size?: number) {
  switch (type) {
    case 'go': return <GoIcon size={size} />;
    case 'jail': return <JailIcon size={size} />;
    case 'free_parking': return <FreeParkingIcon size={size} />;
    case 'go_to_jail': return <GoToJailIcon size={size} />;
    case 'railroad': return <RailroadIcon size={size} />;
    case 'utility':
      return name.toLowerCase().includes('electric')
        ? <ElectricIcon size={size} />
        : <WaterIcon size={size} />;
    case 'tax': return <TaxIcon size={size} />;
    case 'chance': return <ChanceIcon size={size} />;
    case 'community_chest': return <CommunityChestIcon size={size} />;
    default: return null;
  }
}
