# Payment setup

Cash on delivery remains available. PayPal Checkout is implemented on the
backend and is hidden at checkout until both PayPal credentials are configured.
The backend creates the PayPal order, verifies the approved/captured amount in
EUR, and only then records the customer order and deducts stock. The frontend
never receives the PayPal client secret.

## PayPal Sandbox

1. Create a PayPal developer app and use its **Sandbox** client ID and secret.
2. Set these variables in Windows **Environment Variables** for the account that
   runs `Start-Admin.cmd`:
   - `PAYMENTS__PAYPAL__CLIENTID`
   - `PAYMENTS__PAYPAL__SECRET`
   - `PAYMENTS__PAYPAL__MODE=Sandbox`
3. Restart `Start-Admin.cmd` and test with PayPal Sandbox buyer/seller accounts.

Do not put the secret in frontend code, commit it, or send it in chat. Do not
change the mode to `Live` until PayPal confirms that the North Macedonia
business account can receive commercial payments and withdraw its balance to
the intended bank account. Then replace the Sandbox credentials with the
separate Live app credentials.

The API uses PayPal's [Orders v2 Checkout
API](https://developer.paypal.com/docs/checkout/standard/integrate/). The
business account country, ability to receive commercial payments, withdrawal
options, and applicable fees must be confirmed in the merchant account before
launch.

## Bank card acquiring

The checkout never collects or stores card details. When PayPal is configured,
customers may pay by card through PayPal's hosted checkout if PayPal offers that
option for the merchant account and buyer's country. This availability is
controlled by PayPal and cannot be guaranteed by the application. It requires
PayPal Business credentials; no card payment is processed while PayPal is
unconfigured.

The checkout does not integrate a direct bank-card virtual POS. Halkbank AD Skopje advertises an
[e-commerce virtual POS](https://www.halkbank.mk/e-trgovija.nspx), but the
bank's public page does not provide the merchant API, signing rules, test
environment, or onboarding credentials. Obtain the merchant agreement and
current integration package from the bank before connecting it.

Ask each bank for its e-commerce/virtual-POS onboarding, hosted checkout or
redirect/API documentation, test credentials, supported currencies, payment
confirmation/webhook signature rules, and refund procedure. Do not assume
business e-banking or a retail POS terminal can process website orders. After
the bank supplies its integration package, implement and test that bank's
provider adapter before enabling card payments. Never collect or store raw
card numbers or CVV in this application.

Configuration keys are under `Payments` in `Maison.Api/appsettings.json`;
secret values must be supplied through environment variables or the deployment
secret manager.
