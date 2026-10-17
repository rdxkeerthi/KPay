# 🤝 Contributing to KPay

Thank you for your interest in contributing to **KPay** — the zero-commission, cyber-hardened UPI payment engine. We welcome contributions that improve reliability, security, documentation, and provider support.

---

## 🛠️ Development Setup

1. **Prerequisites**:
   - Node.js `>= 18.0.0`
   - npm `>= 9.0.0`
   - Git

2. **Clone & Install**:
   ```bash
   git clone https://github.com/rdxkeerthi/kpay.git
   cd kpay
   npm install
   ```

3. **Run Tests**:
   ```bash
   npm test
   ```

4. **Build the Project**:
   ```bash
   npm run build
   ```

5. **Typecheck**:
   ```bash
   npm run typecheck
   ```

---

## 🔒 Security Guidelines for Contributors

Because KPay is financial infrastructure, all contributions must adhere to strict security rules:

1. **No External Runtime Bloat**: We strictly limit runtime dependencies. Do not add external npm dependencies without prior discussion and security auditing.
2. **Constant-Time Cryptography**: Any comparison involving HMACs, checksums, tokens, or hashes must use `constantTimeEqual()`.
3. **Never Hardcode Credentials in Tests**: Use the built-in `MockAdapter` or generated dummy tokens for unit tests.
4. **Input Validation**: All new methods must validate and sanitize inputs (e.g. order IDs, amounts, phone numbers, VPAs).
5. **Masking**: Ensure new adapters mask sensitive data in log statements.

---

## 📋 Pull Request Process

1. Fork the repo and create a feature branch (`git checkout -b feature/awesome-feature`).
2. Make your changes and add corresponding unit and security tests in `tests/`.
3. Ensure all tests pass: `npm test`.
4. Ensure TypeScript types compile without errors: `npm run typecheck`.
5. Ensure bundle builds cleanly: `npm run build`.
6. Submit a Pull Request with a clear description of the problem solved.
