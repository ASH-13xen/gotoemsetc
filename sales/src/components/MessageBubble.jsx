export default function MessageBubble({ role, content, streaming }) {
  const isEmpty = streaming && !content;
  return (
    <div className={`bubble-row ${role}`}>
      <div className={`bubble${isEmpty ? ' empty' : ''}`}>{content}</div>
    </div>
  );
}
