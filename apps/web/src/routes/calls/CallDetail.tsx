import { useParams } from 'react-router-dom';

export default function CallDetail() {
  const { id } = useParams();
  return (
    <div>
      <h1>Call Detail</h1>
      <p>Call Session ID: {id}</p>
      <p>Pre-call checks, SOA, disclosures, and enrollment panels will display here.</p>
    </div>
  );
}
