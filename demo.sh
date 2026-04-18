#!/bin/bash

# Treasury Guardian - Quick Demo Script
# This walks through the core features of the Policy-Bounded Autonomous Agent.

set -e # Exit on error

echo -e "\x1b[1m\x1b[36m❖ TREASURY GUARDIAN DEMO SEQUENCE\x1b[0m\n"

# 1. Initialization
echo -e "\x1b[1m1. Initializing institutional policies...\x1b[0m"
# If file exists, we'll just skip to show the loaded state
if [ ! -f ~/.zerion/treasury-policy.json ]; then
  node cli/zerion.js treasury policies --init
else
  echo " - Policies already initialized at ~/.zerion/treasury-policy.json"
fi

# 2. Status Check
echo -e "\n\x1b[1m2. Checking current guardian status dashboard...\x1b[0m"
node cli/zerion.js treasury status

# 3. Policy Evaluation
echo -e "\n\x1b[1m3. Running a live policy evaluation cycle (Real-time Oracle read)...\x1b[0m"
node cli/zerion.js treasury evaluate --pretty

# 4. Safety Override (Kill Switch)
echo -e "\n\x1b[1m4. Demonstrating Safety Override (Kill Switch)...\x1b[0m"
node cli/zerion.js treasury kill-switch on
echo " - Kill switch ACTIVATED. Proving execution is blocked:"
node cli/zerion.js treasury trigger --dry-run || echo -e "\n\x1b[31m✓ Execution correctly blocked by safety override.\x1b[0m"

# Reset
node cli/zerion.js treasury kill-switch off
echo -e "\n\x1b[32m❖ Demo Sequence Complete. System is SAFE and ARMED.\x1b[0m"
