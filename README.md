# Loan Bridge

Build a production-ready international lending platform called [APP NAME].

IMPORTANT:

This is NOT a simple landing page or demo. Build the complete application architecture, including the customer web app, admin dashboard, database structure, authentication, loan management, repayment schedules, KYC/document management, guarantee management, notifications, and payment workflow.

The platform is intended to support customers from multiple countries, including European, African, and Western countries.

The system must be designed so that lending rules can be configured independently by country and currency.

==================================================

1. CUSTOMER REGISTRATION & AUTHENTICATION

==================================================

Create a secure registration and login system.

Registration fields:

- First name

- Last name

- Email

- Phone number

- Country of residence

- Date of birth

- Password

Authentication:

- Email/password

- Email verification

- Phone verification

- Forgot password

- Secure session management

- Logout

- Account status

Customer account statuses:

- pending_verification

- verified

- rejected

- suspended

- blocked

Do not allow a customer to submit a loan application until the required verification steps are completed.

==================================================

2. KYC / IDENTITY VERIFICATION

==================================================

Create a complete KYC section.

Customer must provide:

- Government-issued ID

- Selfie / identity verification

- Residential address

- Proof of address

- Proof of income

- Employment or business information

- Bank/payment account information

The required documents must be configurable by country and loan amount.

Document statuses:

- pending

- under_review

- approved

- rejected

- expired

Admin must be able to review documents and approve/reject them.

Customers must receive a reason when a document is rejected.

==================================================

3. CUSTOMER DASHBOARD

==================================================

Create a professional financial dashboard.

Display:

- Available loan limit

- Current loan

- Outstanding balance

- Next payment

- Next payment date

- Repayment progress

- Guarantee amount

- Guarantee status

- Credit score

- Loan history

- Payment history

- Notifications

Main navigation:

Dashboard

My Loans

Apply for a Loan

Repayments

Guarantee

Documents

Profile

Notifications

Support

==================================================

4. LOAN APPLICATION

==================================================

Create a multi-step loan application.

Step 1:

Select country and currency.

Step 2:

Enter desired loan amount.

Step 3:

Select loan duration.

Step 4:

Select repayment frequency:

- Weekly

- Biweekly

- Monthly

Step 5:

Enter purpose of loan.

Step 6:

Financial information.

Step 7:

Review application.

Before submission display:

Loan amount

Duration

Interest rate / applicable cost

Estimated installment

Total amount repayable

Number of installments

Guarantee required

Guarantee amount

Important terms

Customer must explicitly accept the loan terms before submitting.

==================================================

5. GUARANTEE SYSTEM

==================================================

The platform uses a 15% guarantee requirement.

Formula:

Guarantee = Loan Amount × 15%

Examples:

100,000 → 15,000

500,000 → 75,000

1,000,000 → 150,000

5,000 → 750

The guarantee must be treated separately from loan fees, interest, and repayment.

Guarantee statuses:

- required

- pending_payment

- received

- locked

- releasable

- refunded

- partially_claimed

- claimed

- cancelled

Rules:

IF loan application is rejected:

→ guarantee must be refunded according to the applicable process.

IF loan is approved:

→ guarantee becomes locked.

IF customer completely repays the loan:

→ guarantee becomes eligible for release/refund.

The guarantee must NOT automatically be considered income or a loan fee.

Create a complete guarantee transaction history.

==================================================

6. LOAN ENGINE

==================================================

Create a configurable loan engine.

Each loan product must support:

- Country

- Currency

- Minimum loan amount

- Maximum loan amount

- Minimum duration

- Maximum duration

- Interest rate

- APR / total cost parameters where applicable

- Repayment frequency

- Eligibility requirements

- Required documents

- Guarantee percentage

- Early repayment rules

- Late payment rules

Do NOT hard-code these values globally.

They must be configurable by country/product.

==================================================

7. REPAYMENT ENGINE

==================================================

Use a standard amortization system with equal periodic payments where applicable.

The system must automatically calculate:

- Principal

- Interest

- Installment amount

- Total interest

- Total amount repayable

- Remaining principal

- Remaining balance

- Payment dates

For example:

Loan:

5,000 EUR

Duration:

12 months

Annual interest:

12%

Monthly rate:

1%

Generate the complete amortization schedule automatically.

The schedule must contain:

Installment number

Due date

Total payment

Principal portion

Interest portion

Remaining principal

Payment status

Payment statuses:

- upcoming

- due

- paid

- partially_paid

- late

- missed

- waived

- cancelled

==================================================

8. REPAYMENT METHODS

==================================================

Create a payment abstraction layer.

The system should support different payment providers depending on country.

Possible methods:

- Bank transfer

- Card

- Mobile money

- Local payment providers

- Other regulated payment providers

Do NOT hard-code one payment provider.

Create a payment provider configuration system.

Each payment must have:

- transaction ID

- customer

- loan

- installment

- amount

- currency

- provider

- payment method

- status

- timestamp

Payment statuses:

pending

processing

successful

failed

refunded

cancelled

==================================================

9. EARLY REPAYMENT

==================================================

Allow customers to request early repayment.

The system calculates:

- outstanding principal

- accrued amounts where applicable

- applicable charges

- total early settlement amount

Display the calculation before confirmation.

After full repayment:

Loan status:

completed

Guarantee:

eligible_for_release

==================================================

10. LATE PAYMENTS

==================================================

Track overdue payments.

Automatically calculate:

days overdue

overdue amount

number of missed installments

risk status

Risk statuses:

normal

warning

late

serious_delay

default

Late fees or penalties must NOT be hard-coded.

They must be configurable according to the applicable country/product rules.

==================================================

11. CREDIT SCORING

==================================================

Create a configurable internal credit scoring system.

Factors may include:

- KYC verification

- Income

- Employment/business status

- Previous loans

- Previous repayment history

- Late payments

- Defaults

- Debt-to-income ratio

- Account age

- Application history

- Fraud indicators

Create a credit score between 0 and 1000.

Example ranges:

0–299:

Very high risk

300–499:

High risk

500–649:

Medium risk

650–749:

Good

750–849:

Very good

850–1000:

Excellent

These ranges must be configurable.

The score must NEVER be the only factor used for lending decisions.

==================================================

12. PROGRESSIVE CREDIT LIMIT

==================================================

Create a system where customers can progressively increase their borrowing limit.

Example:

New customer:

500 EUR maximum

After successful repayment:

1,000 EUR

After another successful repayment:

2,000 EUR

Then:

5,000 EUR

The system must allow administrators to configure:

Initial limit

Maximum limit

Increase rules

Decrease rules

Number of successful loans required

Risk requirements

==================================================

13. LOAN APPLICATION STATUS

==================================================

Use the following workflow:

draft

submitted

kyc_review

document_review

risk_analysis

guarantee_required

guarantee_pending

underwriting

approved

contract_pending

ready_for_disbursement

disbursed

active

completed

rejected

cancelled

defaulted

Display the current status clearly to the customer.

==================================================

14. 24–72 HOUR PROCESSING

==================================================

After a complete application is submitted, display:

"Your application is being reviewed. Processing may take between 24 and 72 business hours."

Create an internal SLA timer.

Track:

application submitted date

review started

approval date

disbursement date

processing duration

Do NOT promise automatic approval or automatic disbursement.

==================================================

15. LOAN CONTRACT

==================================================

Before disbursement, generate a loan agreement containing:

- Customer information

- Loan amount

- Currency

- Duration

- Interest rate / applicable cost

- Total repayment amount

- Installment amount

- Repayment dates

- Guarantee amount

- Guarantee conditions

- Early repayment conditions

- Late payment conditions

- Default conditions

- Applicable country/product terms

Customer must accept the contract electronically.

Store:

contract version

acceptance timestamp

IP/device information where legally permitted

contract status

==================================================

16. ADMIN DASHBOARD

==================================================

Create a complete admin dashboard.

Sections:

Overview

Customers

KYC

Documents

Loan Applications

Active Loans

Repayments

Guarantees

Payments

Credit Risk

Loan Products

Countries

Currencies

Interest/Cost Rules

Notifications

Reports

Audit Logs

Settings

Dashboard statistics:

Total customers

Verified customers

Pending KYC

Applications today

Pending applications

Approved loans

Rejected loans

Active loans

Total amount disbursed

Total outstanding

Total repayments

Overdue amount

Default rate

Guarantees held

Guarantees released

==================================================

17. ADMIN LOAN REVIEW

==================================================

For each application display:

Customer profile

KYC status

Documents

Credit score

Income

Existing debt

Requested amount

Maximum eligible amount

Guarantee amount

Loan duration

Repayment schedule

Risk indicators

Fraud indicators

Previous loans

Previous repayments

Admin actions:

Approve

Reject

Request additional documents

Change approved amount

Change duration

Put application on hold

Every important action must be logged.

==================================================

18. FRAUD & SECURITY

==================================================

Implement security mechanisms including:

- Email verification

- Phone verification

- Rate limiting

- Suspicious login detection

- Duplicate account detection

- Duplicate identity detection

- Device/IP risk indicators where legally permitted

- Multiple application detection

- Suspicious payment detection

- Admin audit logs

Never expose sensitive customer documents publicly.

Use secure storage and access policies.

==================================================

19. DATABASE

==================================================

Use Supabase PostgreSQL.

Create appropriate tables including:

users

profiles

countries

currencies

loan_products

loan_applications

loans

loan_installments

payments

guarantees

guarantee_transactions

documents

kyc_verifications

credit_scores

credit_decisions

contracts

notifications

support_tickets

audit_logs

admin_users

payment_providers

risk_rules

Use UUID primary keys.

Create proper foreign keys.

Add created_at and updated_at timestamps.

Use Row Level Security.

Customers can only access their own data.

Admins can access data according to their permissions.

==================================================

20. MULTI-CURRENCY

==================================================

The platform must support:

EUR

USD

GBP

CAD

AUD

XOF

XAF

and additional currencies later.

Never store monetary amounts as floating-point numbers.

Use appropriate decimal/numeric database types.

Every transaction must contain its currency.

==================================================

21. MULTI-COUNTRY

==================================================

Create a country configuration system.

For every country allow configuration of:

- supported currency

- loan products

- minimum/maximum amount

- duration

- repayment frequency

- required documents

- KYC requirements

- guarantee percentage

- applicable fees/costs

- risk rules

- payment providers

- eligibility criteria

Do not assume that the same lending rules are legal or appropriate in every country.

==================================================

22. NOTIFICATIONS

==================================================

Create notifications for:

Account verification

KYC approval

KYC rejection

Loan application submitted

Additional documents required

Loan approved

Loan rejected

Guarantee required

Guarantee received

Loan disbursed

Upcoming payment

Payment successful

Payment failed

Payment overdue

Loan completed

Guarantee released

Support:

Email

SMS

In-app notifications

==================================================

23. CUSTOMER SUPPORT

==================================================

Create a support ticket system.

Customer can:

Create ticket

Select category

Describe problem

Attach document

View responses

Close ticket

Admin can:

Reply

Change status

Assign ticket

Add internal notes

==================================================

24. UI/UX

==================================================

Create a professional fintech-style interface.

Design requirements:

- Modern

- Clean

- Trustworthy

- Responsive

- Mobile-first

- Desktop compatible

- Clear financial information

- Strong visual hierarchy

- Accessible forms

- Clear error messages

- Confirmation screens before financial actions

Do not use a casino, gambling, crypto, or flashy visual style.

Use a professional financial-services aesthetic.

==================================================

25. IMPORTANT FINANCIAL SAFETY

==================================================

Do not create fake balances.

Do not simulate successful payments as real payments.

Do not automatically mark a guarantee as received without a verified payment transaction.

Do not automatically approve loans without the configured underwriting process.

Separate:

application

approval

guarantee

contract

disbursement

repayment

guarantee release

Every financial transaction must have a traceable transaction record.

==================================================

26. LEGAL / COMPLIANCE ARCHITECTURE

==================================================

The platform is international.

Build the technical architecture so that compliance rules can be configured by country.

Include placeholders/configuration for:

KYC

AML

sanctions screening

responsible lending

consumer disclosures

privacy

data retention

consent

electronic contracts

country-specific lending requirements

Do not claim that the platform is legally authorized to lend in any country.

Do not hard-code legal assumptions.

==================================================

27. DEVELOPMENT APPROACH

==================================================

Use:

Frontend:

React

TypeScript

Tailwind CSS

Backend:

Supabase

PostgreSQL

Supabase Auth

Supabase Storage

Supabase Edge Functions where necessary

Create clean reusable components.

Create a proper database schema.

Create secure RLS policies.

Create server-side financial calculations.

Never trust client-side calculations for loan amounts, payments, guarantees, or balances.

==================================================

28. FIRST VERSION

==================================================

Build the following fully functional MVP first:

1. Registration/login

2. Profile

3. Country selection

4. KYC/document upload

5. Admin KYC review

6. Loan application

7. Loan calculation

8. 15% guarantee calculation

9. Admin loan review

10. Loan approval/rejection

11. Repayment schedule generation

12. Customer loan dashboard

13. Payment records

14. Guarantee status

15. Notifications

16. Admin dashboard

17. Audit logs

Do not build unnecessary features before these core functions work correctly.

Before writing UI code, create the database schema and application architecture.

Then implement the application in logical stages.

Make sure the entire application remains functional after each stage.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2905f917-ebd4-4c15-8534-b9cb172a8cd0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
