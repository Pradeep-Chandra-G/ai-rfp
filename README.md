# 🧠 AI-Powered RFP Management System

> **Automated Procurement Lifecycle Management**
> A Next.js application designed to streamline the Request for Proposal (RFP) process using Generative AI, OCR, and automated workflows.

## 📋 Table of Contents
- [🧠 AI-Powered RFP Management System](#-ai-powered-rfp-management-system)
  - [📋 Table of Contents](#-table-of-contents)
  - [🚀 Overview](#-overview)
  - [✨ Key Features](#-key-features)
  - [🛠 Tech Stack](#-tech-stack)
    - [Core](#core)
    - [Services](#services)
  - [🏗 Architecture](#-architecture)
  - [🏁 Getting Started](#-getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
  - [🗄 Database Schema](#-database-schema)
  - [📡 API Documentation](#-api-documentation)
    - [1. RFP Creation](#1-rfp-creation)
    - [2. Proposal Webhook](#2-proposal-webhook)
    - [3. Attachment Processing (OCR)](#3-attachment-processing-ocr)
    - [4. Comparison Engine](#4-comparison-engine)
  - [🤖 AI \& OCR Strategy](#-ai--ocr-strategy)

---

## 🚀 Overview

This system addresses the challenge of unstructured data in procurement. Traditionally, comparing vendor proposals requires manually reading emails and PDF attachments. This application automates that process by:
1.  **Structuring Requests:** Converting natural language needs into strict JSON RFPs.
2.  **Automating Ingestion:** Using webhooks to capture and parse vendor emails.
3.  **Digitizing Documents:** Applying OCR to attachments to extract line-item pricing.
4.  **Intelligent Comparison:** Normalizing data to provide "apples-to-apples" vendor comparisons.

---

## ✨ Key Features

* **🤖 AI RFP Generation:** Input a messy paragraph of requirements, and the system outputs a validated, structured RFP object.
* **📧 Email Automation:** Seamlessly send RFPs to vendors and process their replies via Resend Webhooks.
* **📄 Attachment OCR:** Automatically extracts pricing, warranty, and delivery terms from PDF and Image attachments using Computer Vision and LLMs.
* **📊 Smart Scoring:** Assigns a "Completeness Score" (0-100) to proposals based on how well they match requirements.
* **⚖️ Decision Support:** Generates a comparative analysis with a recommended winner and negotiation action items.

---

## 🛠 Tech Stack

### Core
* **Framework:** Next.js 16 (App Router)
* **Language:** TypeScript
* **Styling:** Tailwind CSS v4
* **Database:** PostgreSQL with Prisma ORM

### Services
* **AI Inference:** Groq (LLaMA 4 model) for high-speed text generation and structured outputs.
* **Email:** Resend for outbound emails and inbound parsing.
* **Storage:** Vercel Blob for secure storage of vendor attachments.
* **PDF Processing:** `unpdf` for server-side text extraction.

---

## 🏗 Architecture

1.  **Creation:** User prompt -> Groq API -> JSON Schema -> `RFP` Database Record.
2.  **Distribution:** `SendRFPButton` -> `/api/rfp/send` -> Resend Email API -> Vendor Inbox.
3.  **Ingestion:** Vendor Reply -> Resend Webhook -> `/api/inbound/proposal` -> Attachment Upload (Blob) -> Initial Parsing -> Database.
4.  **Enrichment:** Async Background Process -> `/api/proposals/.../process-attachments` -> OCR -> Database Update.
5.  **Analysis:** Comparison Page -> `/api/rfp/.../compare` -> Data Normalization -> LLM Analysis -> Recommendation.

---

## 🏁 Getting Started

### Prerequisites
* Node.js v18+
* PostgreSQL Database
* API Keys: Groq, Resend, Vercel Blob

### Installation

1.  **Clone and Install:**
    ```bash
    git clone [repo-url]
    cd ai-rfp
    npm install
    ```

2.  **Environment Setup:**
    Create a `.env` file:
    ```env
    DATABASE_URL="postgresql://..."
    GROQ_API_KEY="gsk_..."
    RESEND_API_KEY="re_..."
    RESEND_INBOUND_EMAIL="inbound@your-domain.com"
    BLOB_READ_WRITE_TOKEN="vercel_blob_..."
    NEXT_PUBLIC_BASE_URL="http://localhost:3000"
    ```

3.  **Database Initialization:**
    ```bash
    npx prisma generate
    npx prisma migrate dev --name init
    npm run seed # Optional: Seeds mock vendors and RFPs
    ```

4.  **Run Development Server:**
    ```bash
    npm run dev
    ```

---

## 🗄 Database Schema

The application uses a relational schema with **JSONB** fields for flexibility with AI data.

* **RFP:** The core request document.
    * `requirements`: JSONB (Stores the structured output from the LLM).
* **Vendor:** Master data for suppliers.
* **Proposal:** The vendor's response.
    * `pricing`: JSONB (Stores extracted line items and total cost).
    * `attachments`: JSONB (Stores array of file URLs and metadata).
* **RFPVendor:** Join table tracking the state of an RFP sent to a specific vendor.

---

## 📡 API Documentation

### 1. RFP Creation
**Endpoint:** `POST /api/rfp/create`
* **Input:** `{ "naturalLanguageInput": "I need 20 laptops..." }`
* **Behavior:** Uses `StructuredRFPZod` schema to force the LLM to return a valid JSON object with fields like `budget`, `deadline`, and `requiredItems`.
* **Output:** The created `RFP` object.

### 2. Proposal Webhook
**Endpoint:** `POST /api/inbound/proposal`
* **Input:** Resend Webhook Event (`email.received`).
* **Behavior:**
    1.  Extracts the `RFP-ID` UUID from the email body.
    2.  Uploads all attachments to Vercel Blob.
    3.  Parses the email body using Groq to extract preliminary pricing.
    4.  Triggers the OCR processing endpoint asynchronously.

### 3. Attachment Processing (OCR)
**Endpoint:** `POST /api/proposals/[proposalId]/process-attachments`
* **Behavior:**
    * **Images:** Processed via Groq Vision models (llama-4-maverick-17b-128e-instruct).
    * **PDFs:** Text extracted via `unpdf` and structured by LLM.
    * **Logic:** Calculates a **Data Confidence Score** by comparing the price found in the email vs. the price found in the document.

### 4. Comparison Engine
**Endpoint:** `GET /api/rfp/[rfpId]/compare`
* **Behavior:** Aggregates all proposals for an RFP. Normalizes fields (e.g., converting "2 weeks" to "14 days") and feeds the dataset to an LLM to generate a winner recommendation based on weighted criteria (Price > Completeness > Delivery).

---

## 🤖 AI & OCR Strategy

* **Structured Outputs:** We strictly enforce **Zod Schemas** on all LLM outputs. This prevents the "hallucination" of invalid data fields and ensures the frontend never crashes due to malformed JSON.
* **Hybrid Parsing:** We don't rely on a single source of truth. We extract data from *both* the email body and the attachments. If they match, confidence is high (Green). If they differ, confidence is low (Red), flagging the proposal for human review.