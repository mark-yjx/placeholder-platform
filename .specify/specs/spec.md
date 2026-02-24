## Product Specification (WHAT + WHY)
**Project:** COMP9021 Practice Platform  
**Phase:** Specification (no implementation decisions)

## 1. Product Purpose
Create a practice platform for COMP9021 where students solve Python programming problems and receive objective feedback, while teachers/admins manage content and course integrity.

## 2. Goals and Success Outcomes
1. Students can practice effectively with fast, reliable judging feedback.
2. Teachers can manage problem sets and monitor activity from one system.
3. The platform supports fairness and trust via permission isolation.
4. Engagement is encouraged through favorites, reviews, rankings, and public stats.

## 3. Users and Value
### Student
- Fetch and attempt problems to improve coding skills.
- Submit Python code and get verdicts (AC/WA/TLE/RE/CE) with time and memory usage.
- Track progress through stats and rankings.
- Use favorites and reviews to curate and evaluate problems.

### Admin (Teacher)
- Create, edit, publish, and remove problems.
- Manage submissions and monitor outcomes.
- Publish announcements for class communication.

## 4. In-Scope Features (MVP + Core)
### 4.1 Authentication and Access
- Email + password login for students.
- Role-based access (student vs admin), with strict permission isolation.

**Why:** Protect accounts and ensure only authorized actions are possible.

### 4.2 Problem Management (Admin)
- Admin can create, read, update, and delete problems.
- Problems are available for students to fetch once published.

**Why:** Teachers need full control of learning content.

### 4.3 Problem Practice and Submission (Student)
- Students can browse/fetch available Python problems.
- Students can submit Python code for a selected problem.
- Judge returns verdict + execution time + memory usage.

**Why:** Core learning loop is attempt → submit → feedback.

### 4.4 Judging
- Judge supports Python problems.
- Judge execution is sandboxed.
- Returned result must include:
  - Verdict: AC, WA, TLE, RE, CE
  - Time usage
  - Memory usage

**Why:** Consistent, safe, objective evaluation.

### 4.5 Social and Engagement
- Students can favorite/unfavorite problems.
- Students can review problems with text and like/dislike.
- Students can view public statistics and rankings.

**Why:** Improve discoverability, motivation, and feedback quality.

### 4.6 Submission Oversight (Admin)
- Admin can view and manage student submissions.

**Why:** Enable course governance and integrity control.

### 4.7 Announcements (Admin)
- Admin can publish announcements visible to students.

**Why:** Centralized course communication.

## 5. Functional Requirements (Testable)
1. The system shall require student login via email and password before student-only actions.
2. The system shall prevent students from accessing admin-only functions.
3. The system shall allow admins to perform CRUD operations on problems.
4. The system shall allow students to fetch published problems.
5. The system shall accept Python code submissions from authenticated students.
6. The system shall return for each submission exactly one verdict from {AC, WA, TLE, RE, CE}.
7. The system shall return time and memory metrics with each judge result.
8. The system shall allow students to favorite and unfavorite problems.
9. The system shall allow students to submit text reviews and a like/dislike sentiment per problem.
10. The system shall display public statistics and rankings to students.
11. The system shall allow admins to view/manage submissions.
12. The system shall allow admins to create and publish announcements.

## 6. Non-Functional Product Requirements (Testable, Non-Technical)
1. **Permission Isolation:** No user can perform actions outside their role permissions.
2. **Result Clarity:** Every judged submission must produce a clearly interpretable outcome (verdict + time + memory).
3. **Auditability:** Admin actions on problems/submissions/announcements must be attributable to an admin account.
4. **Usability Baseline:** Core student flow (login → fetch problem → submit → view result) must be completable without admin assistance.

## 7. MVP Acceptance Criteria (Explicit)
MVP is accepted only if all are true:
1. Student can log in with email + password.
2. Admin can CRUD problems.
3. Student can submit Python code and receive judge result (AC/WA/TLE/RE/CE + time + memory).
4. Basic statistics are available to students.
5. Permission isolation is enforced between student and admin capabilities.

## 8. Out of Scope for MVP
- Any language other than Python.
- Advanced analytics beyond basic statistics/rankings.
- 2FA authentication.
- Plagiarism checks.
- Non-teacher admin hierarchies or multi-tenant institution management.

## 9. Phase 2 (Future Enhancements)
### 9.1 Authentication Enhancements
- Add mandatory 2FA for student sign-in.
- Support TOTP-based second-factor verification and related account recovery flows.

### 9.2 Academic Integrity Enhancements
- Add admin plagiarism checks across submissions.
- Provide plagiarism reporting views for admin oversight workflows.

### 9.3 Phase 2 Functional Requirements
1. The system shall require student login via email, password, and 2FA before student-only actions.
2. The system shall allow admins to run plagiarism checks on submissions.
