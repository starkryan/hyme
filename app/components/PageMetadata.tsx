import { WebsiteStructuredData, OrganizationStructuredData, ServiceStructuredData, FAQStructuredData } from './StructuredData';

export default function PageMetadata() {
  return (
    <>
      <WebsiteStructuredData />
      <OrganizationStructuredData />
      <ServiceStructuredData />
      <FAQStructuredData />
    </>
  );
} 