/** All user-visible copy (i18n-ready). Buttons are verb + object. */
export const t = {
  app: 'SkyEmpire',
  sections: {
    overview: 'Overview', network: 'Network', fleet: 'Fleet', finance: 'Finance', market: 'Market', airline: 'Airline', news: 'News',
  },
  speed: { pause: 'Pause', play: 'Play', label: (s: number) => `${s}× speed` },
  topbar: { notifications: (n: number) => (n ? `${n} new notifications` : 'Notifications'), menu: 'Menu' },
  inspector: { close: 'Close panel' },
  tray: { show: 'Show table', hide: 'Hide table' },
  menu: { save: 'Save game', load: 'Load game', settings: 'Settings', shortcuts: 'Keyboard shortcuts', quit: 'Quit to title', resume: 'Resume' },
  saved: 'Game saved',
  shortcuts: [
    ['1–7', 'Switch section'], ['Space', 'Pause / resume'], ['+ / −', 'Faster / slower'], ['N', 'New route'],
    ['T', 'Show or hide the table'], ['/', 'Search'], ['Esc', 'Close panel or open menu'], ['Ctrl+S', 'Save game'], ['?', 'Show shortcuts'],
  ] as [string, string][],
};
