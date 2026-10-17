#!/usr/bin/env node

/**
 * KPay Post-Install Hook
 * Author: rdxkeerthi
 */

function printWelcomeBanner() {
  // Only display in interactive terminals or standard installs (skip if silent)
  if (process.env.npm_config_loglevel === 'silent' || process.env.CI) {
    return;
  }

  const cyan = '\x1b[36m';
  const bold = '\x1b[1m';
  const green = '\x1b[32m';
  const yellow = '\x1b[33m';
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';

  console.log(`
${cyan}${bold}┌──────────────────────────────────────────────────────────────────┐${reset}
${cyan}${bold}│${reset}                                                                  ${cyan}${bold}│${reset}
${cyan}${bold}│${reset}   ⚡ ${bold}Thanks for installing KPay!${reset}                                 ${cyan}${bold}│${reset}
${cyan}${bold}│${reset}   ${green}Crafted with ❤️  by ${bold}rdxkeerthi${reset}                                 ${cyan}${bold}│${reset}
${cyan}${bold}│${reset}                                                                  ${cyan}${bold}│${reset}
${cyan}${bold}│${reset}   ${yellow}•${reset} Enterprise-grade, zero-commission UPI gateway for Node.js    ${cyan}${bold}│${reset}
${cyan}${bold}│${reset}   ${yellow}•${reset} Direct-to-bank settlement, multi-PSP routing & live SSE        ${cyan}${bold}│${reset}
${cyan}${bold}│${reset}                                                                  ${cyan}${bold}│${reset}
${cyan}${bold}│${reset}   ${dim}Documentation:${reset} https://github.com/rdxkeerthi/kpay#readme       ${cyan}${bold}│${reset}
${cyan}${bold}│${reset}                                                                  ${cyan}${bold}│${reset}
${cyan}${bold}└──────────────────────────────────────────────────────────────────┘${reset}
`);
}

try {
  printWelcomeBanner();
} catch {
  // Graceful fallback: never fail an npm install due to a banner
}
