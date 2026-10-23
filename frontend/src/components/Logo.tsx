function Logo({ className = 'h-11 w-11' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Study Tracker">
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#logo-bg)" />
      <path d="M13 21c6-2 13-1 19 4v23c-6-4-13-5-19-3z" fill="#fff" />
      <path d="M51 21c-6-2-13-1-19 4v23c6-4 13-5 19-3z" fill="#fff" fillOpacity=".86" />
      <path
        d="M37.5 34.5l4 4 7-8.5"
        fill="none"
        stroke="#4f46e5"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default Logo
