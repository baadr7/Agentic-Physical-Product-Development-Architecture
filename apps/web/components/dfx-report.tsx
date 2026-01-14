import React from 'react';

export interface DfxScoresProps {
  scores: {
    fabricability_score?: number;
    assemblability_score?: number;
    sustainability_score?: number;
    physical_score?: number;
    aesthetic_score?: number;
    user_score?: number;
    overall_score?: number;
    weights?: Record<string, number>;
  };
  summary?: string;
}

export const DfxReport: React.FC<DfxScoresProps> = ({ scores, summary }) => {
  const entries = Object.entries(scores || {}).filter(([k]) => k.endsWith('_score'));
  return (
    <div style={{border:'1px solid #ddd', padding:'1rem', borderRadius:8}}>
      <h3>DfX Multi-Objective Report</h3>
      {summary && <p style={{fontStyle:'italic'}}>{summary}</p>}
      <table style={{width:'100%', fontSize:14}}>
        <thead>
          <tr><th>Aspect</th><th>Score</th></tr>
        </thead>
        <tbody>
        {entries.map(([k,v]) => (
          <tr key={k}><td>{k.replace('_score','')}</td><td>{v}</td></tr>
        ))}
        </tbody>
      </table>
      {scores.weights && (
        <div style={{marginTop:12}}>
          <strong>Weights:</strong> {Object.entries(scores.weights).map(([k,v]) => `${k}=${(v*100).toFixed(1)}%`).join(' ')}
        </div>
      )}
    </div>
  );
};

export default DfxReport;
