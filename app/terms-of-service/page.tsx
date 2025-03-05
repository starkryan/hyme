import { Metadata } from "next"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export const metadata: Metadata = {
  title: "Terms of Service | Hyme",
  description: "Terms of service and user agreement for Hyme users",
}

export default function TermsOfService() {
  return (
    <div className="container max-w-4xl py-6 lg:py-10">
      <div className="flex flex-col items-start gap-4 md:gap-6">
        <div className="flex flex-col items-start gap-2">
          <h1 className="text-3xl font-bold leading-tight tracking-tighter md:text-4xl lg:leading-[1.1]">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
        <Separator className="my-4" />
        
        <Card className="w-full p-6">
          <div className="flex flex-col gap-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4">Agreement to Terms</h2>
              <p className="text-muted-foreground leading-7">
                By accessing or using Hyme, you agree to be bound by these Terms of Service. If you disagree with any part of these terms, 
                you may not access our service. These Terms of Service apply to all users and others who access or use our service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Use of Service</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-2">Account Registration</h3>
                  <p className="text-muted-foreground leading-7">
                    When you create an account with us, you must provide accurate, complete, and current information. 
                    Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2">User Responsibilities</h3>
                  <p className="text-muted-foreground leading-7">
                    You are responsible for:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                    <li>Maintaining the confidentiality of your account</li>
                    <li>All activities that occur under your account</li>
                    <li>Notifying us immediately of any unauthorized use</li>
                    <li>Ensuring your account information is accurate</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Prohibited Activities</h2>
              <p className="text-muted-foreground leading-7 mb-4">
                You agree not to engage in any of the following activities:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Using the service for any illegal purpose</li>
                <li>Attempting to gain unauthorized access to our systems</li>
                <li>Interfering with or disrupting the service</li>
                <li>Selling or transferring your account to another party</li>
                <li>Using the service to spam or harass others</li>
                <li>Attempting to manipulate or abuse our service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Payment Terms</h2>
              <p className="text-muted-foreground leading-7">
                By using our paid services, you agree to pay all fees and charges associated with your account. 
                All payments are non-refundable unless required by law. We reserve the right to modify our pricing 
                with reasonable notice to users.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Service Modifications</h2>
              <p className="text-muted-foreground leading-7">
                We reserve the right to modify, suspend, or discontinue any part of our service at any time, 
                with or without notice. We shall not be liable to you or any third party for any modification, 
                suspension, or discontinuation of the service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Limitation of Liability</h2>
              <p className="text-muted-foreground leading-7">
                To the maximum extent permitted by law, Hyme and its affiliates shall not be liable for any indirect, 
                incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether 
                incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Termination</h2>
              <p className="text-muted-foreground leading-7 mb-4">
                We may terminate or suspend your account and access to the service immediately, without prior notice or liability, for any reason, including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Breach of these Terms</li>
                <li>Suspected fraudulent, abusive, or illegal activity</li>
                <li>Non-payment of any fees</li>
                <li>Extended periods of inactivity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">Contact Information</h2>
              <p className="text-muted-foreground leading-7">
                If you have any questions about these Terms of Service, please contact us:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                <li>Telegram: <a href="https://t.me/otpmaya" className="text-blue-500 hover:underline">OTPMaya</a></li>
                <li>Through our contact form on the website</li>
              </ul>
            </section>
          </div>
        </Card>
      </div>
    </div>
  )
}