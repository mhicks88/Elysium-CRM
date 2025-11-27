import { useParams } from 'react-router-dom';

export default function LeadDetail() {
  const { id } = useParams();
  return (
    <div>
      <h1>Lead Detail</h1>
      <p>Lead ID: {id}</p>
      <p>Tasks, notes, calls, and SOA panels will be shown here.</p>
    </div>
  );
}
