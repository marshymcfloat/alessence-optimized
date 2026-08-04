export default function AppLoading() {
  return (
    <div className="stack" aria-label="Loading">
      <div className="skeleton" style={{ width: "45%", height: "3rem" }} />
      <div className="skeleton" style={{ height: "14rem" }} />
      <div className="skeleton" style={{ height: "8rem" }} />
    </div>
  );
}
