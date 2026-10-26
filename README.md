# MLOT Analyzer — Money Left on the Table

MLOT (Money Left on the Table) is PowerTies' free front-door diagnostic for small business owners. The owner signs in, answers a chat-style diagnostic about how the business runs, and gets a Gemini-generated analysis of where money is being left on the table. The application code lives in `MLOT/mlot-analyzer/` inside this repo.

## What it does
- Sign in with Google (Firebase) or DeSo — the diagnostic starts only for a signed-in visitor
- A guided diagnostic conversation across the six parts of a business: Leadership, Culture & Legacy, Processes, Sales & Marketing, Customer Retention, and Collections
- A Gemini-generated analysis with a results dashboard and charts
- A deep link from powerties.us (`/?start=assessment`) that starts the diagnostic as soon as the visitor is signed in

## Built with
React, Vite, TypeScript, Google Gemini (@google/genai), Firebase Auth, DeSo Protocol, Recharts

## Status
Live — https://mlot.vercel.app

## Part of
Business Package — the free front door of the journey, and the Free tier of the PowerTies app gate.
