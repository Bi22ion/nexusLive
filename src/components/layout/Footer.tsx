"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-10 border-t border-white/10 pt-10 pb-10 text-sm text-neutral-400">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <Col title="Work With Us">
          <Item href="/affiliates">Affiliate Program</Item>
          <Item href="/recruitment">Model Recruitment</Item>
          <Item href="/studios">Studio Partnership</Item>
        </Col>
        <Col title="Legal & Safety">
          <Item href="/legal/privacy">Privacy Policy</Item>
          <Item href="/legal/2257">18 U.S.C. 2257 Statement</Item>
          <Item href="/legal/dmca">DMCA Policy</Item>
        </Col>
        <Col title="Help & Support">
          <Item href="/support/billing">Billing Support</Item>
          <Item href="/support/faq">Technical FAQ</Item>
          <Item href="/support/contact">Contact</Item>
        </Col>
        <Col title="NexusLive">
          <div className="text-xs leading-5 text-neutral-500">
            NexusLive is an adult platform for users 18+. Stream access and
            features may be restricted by jurisdiction.
          </div>
        </Col>
      </div>
      <div className="mt-8 text-xs text-neutral-600">
        © {new Date().getFullYear()} NexusLive. All rights reserved.
      </div>
    </footer>
  );
}

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 text-xs font-semibold tracking-widest text-neutral-300">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Item({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block hover:text-white transition-colors">
      {children}
    </Link>
  );
}

