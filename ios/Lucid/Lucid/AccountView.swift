import SwiftUI

struct AccountView: View {
    @EnvironmentObject private var store: LearningStore
    @Environment(\.dismiss) private var dismiss
    var deleting = false
    @State private var email = ""
    @State private var sentEmail: String?
    @State private var code = ""
    @State private var includeGuest = false
    @State private var resendAfter = Date.distantPast
    @State private var confirmDelete = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Image(systemName: deleting ? "person.crop.circle.badge.minus" : "lock.icloud")
                        .font(.largeTitle)
                        .foregroundStyle(LucidColour.mint)
                    Text(deleting ? "Your account. Your choice." : "Keep your words with you.")
                        .font(.system(.largeTitle, design: .serif))
                    Text(deleting ? "Verify your email, then confirm deletion. This permanently removes your account and cloud learning history." : "Sign in with a code sent to your email. Restore your lessons, saved words, and progress on another device.")
                        .foregroundStyle(LucidColour.secondaryOnDark)
                    #if DEBUG
                    if !deleting {
                        Label("Private cloud preview. Signing in shares your email with Supabase and Lucid’s email provider, Resend. Your profile, saved words, review schedule, and learning activity are backed up to your Lucid account. Practice sentences stay on this device. The public privacy policy still describes the guest-only release.", systemImage: "info.circle")
                            .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
                            .padding(18).background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 16))
                    }
                    #endif
                    if store.accountService?.emailDeliveryReady != true {
                        Label("Email sign-in is not ready in this build. No code can be sent yet. Your local learning is kept on this device.", systemImage: "info.circle")
                            .padding(18).background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 16))
                        Button("Continue learning") { dismiss() }
                            .buttonStyle(.borderedProminent).tint(LucidColour.mint).foregroundStyle(LucidColour.midnight)
                    } else {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Email address").font(.headline)
                            TextField("you@example.com", text: $email)
                                .keyboardType(.emailAddress).textContentType(.emailAddress)
                                .textInputAutocapitalization(.never).autocorrectionDisabled()
                                .padding(16).background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 12))
                                .disabled(sentEmail != nil || store.session != nil || store.accountBusy)
                                .accessibilityIdentifier("account.email")
                            if let sentEmail {
                                Text("Enter the code sent to \(sentEmail). Check your spam folder too.")
                                    .font(.subheadline).foregroundStyle(LucidColour.secondaryOnDark)
                                TextField("Verification code", text: $code)
                                    .keyboardType(.numberPad).textContentType(.oneTimeCode)
                                    .padding(16).background(LucidColour.surface, in: RoundedRectangle(cornerRadius: 12))
                                    .accessibilityLabel("Email verification code")
                                    .accessibilityIdentifier("account.code")
                                    .onChange(of: code) { _, value in code = String(value.filter { $0.isASCII && $0.isNumber }.prefix(10)) }
                                TimelineView(.periodic(from: .now, by: 1)) { context in
                                    let wait = max(0, Int(ceil(resendAfter.timeIntervalSince(context.date))))
                                    HStack {
                                        Button(wait > 0 ? "Resend in \(wait)s" : "Resend code") {
                                            Task {
                                                if await store.sendLoginCode(email: sentEmail) {
                                                    code = ""
                                                    resendAfter = .now.addingTimeInterval(60)
                                                }
                                            }
                                        }.disabled(wait > 0 || store.accountBusy)
                                        Spacer()
                                        if store.session == nil {
                                            Button("Change email") { self.sentEmail = nil; code = ""; store.accountNotice = nil }
                                                .disabled(store.accountBusy)
                                        }
                                    }
                                    .font(.subheadline).frame(minHeight: 44)
                                }
                            }
                        }
                        if store.session == nil && store.profile != nil {
                            Toggle("Add this device’s guest progress to my account", isOn: $includeGuest)
                            Text("Only choose this if the guest learning on this device belongs to you.")
                                .font(.caption).foregroundStyle(LucidColour.secondaryOnDark)
                        }
                        if let notice = store.accountNotice {
                            Label(notice, systemImage: "exclamationmark.circle")
                                .foregroundStyle(LucidColour.coral)
                                .accessibilityIdentifier("account.error")
                        }
                        Button {
                            Task {
                                if let sentEmail {
                                    if await store.verifyLogin(email: sentEmail, code: code, includeGuest: includeGuest) {
                                        if deleting { confirmDelete = true } else { dismiss() }
                                    } else {
                                        // A verified code can be consumed before secure local
                                        // storage finishes. Retain the resend cooldown, not the code.
                                        code = ""
                                    }
                                } else if let requestedEmail = try? AccountService.normalizedEmail(email) {
                                    // Capture the address before awaiting; edits must never redirect
                                    // the verification step away from the address we actually emailed.
                                    if await store.sendLoginCode(email: requestedEmail) {
                                        sentEmail = requestedEmail
                                        resendAfter = .now.addingTimeInterval(60)
                                    }
                                }
                            }
                        } label: {
                            HStack {
                                if store.accountBusy { ProgressView().tint(LucidColour.midnight) }
                                Text(store.accountBusy ? "Please wait…" : (sentEmail == nil ? "Send verification code" : (deleting ? "Verify before deleting" : "Verify and sign in")))
                            }.frame(maxWidth: .infinity, minHeight: 54).font(.headline)
                        }
                        .buttonStyle(.borderedProminent).tint(LucidColour.mint).foregroundStyle(LucidColour.midnight)
                        .disabled(store.accountService?.emailDeliveryReady != true || store.accountBusy || (sentEmail == nil ? (try? AccountService.normalizedEmail(email)) == nil : code.count < 6))
                    }
                    Text("Practice sentences stay on this device. Cloud backup includes your profile, learning activity, review schedule, and saved words.")
                        .font(.footnote).foregroundStyle(LucidColour.secondaryOnDark)
                    Link("Read the privacy policy", destination: URL(string: "https://lucid-vocabulary-sunil.sunilkumar-kalabandi.chatgpt.site/privacy")!)
                }.padding(24).frame(maxWidth: 620).frame(maxWidth: .infinity)
            }
            .foregroundStyle(LucidColour.textOnDark)
            .lucidBackground()
            .lucidKeyboardDismissal()
            .navigationTitle(deleting ? "Delete account" : "Your Lucid account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() }.disabled(store.accountBusy) } }
            .toolbarBackground(LucidColour.midnight, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .preferredColorScheme(.dark)
            .interactiveDismissDisabled(store.accountBusy)
            .onAppear { email = store.session?.user.email ?? ""; store.accountNotice = nil }
            .onChange(of: store.accountNotice) { _, notice in
                if let notice { LucidAccessibility.announce(notice) }
            }
            .confirmationDialog("Permanently delete your account?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete account and cloud data", role: .destructive) {
                    Task { if await store.deleteAccount() { dismiss() } }
                }
                Button("Keep my account", role: .cancel) {}
            } message: {
                Text("This removes your account and its learning history from Lucid’s cloud and this device. A separate guest profile is not affected. This cannot be undone.")
            }
        }
    }
}
