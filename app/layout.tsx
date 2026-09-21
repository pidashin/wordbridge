import type { Metadata } from 'next';
import './globals.css';
import ApolloClientProvider from './components/ApolloClientProvider';

export const metadata: Metadata = {
  title: 'WordBridge',
  description: 'A project for language learning',
};

const GRAPHQL_URI = '/api/graphql';

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ApolloClientProvider uri={GRAPHQL_URI}>
          {children}
        </ApolloClientProvider>
      </body>
    </html>
  );
}
