import { useState } from 'react';
import { Fleet as SdkFleet, UnitType, calculateFleetAttack, calculateFleetDefense, getUnitCost } from '@starbound-realms/sdk';

const UNIT_TYPES: UnitType[] = ['Scout', 'Fighter', 'Cruiser', 'Dreadnought'];

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '1.5rem',
    marginTop: '1rem',
  },
  title: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: '1rem',
  },
  unitGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  unitCell: {
    textAlign: 'center',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  unitCount: {
    fontSize: '1.3rem',
    fontWeight: 700,
    color: 'var(--text)',
    display: 'block',
  },
  powerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.4rem 0',
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    borderTop: '1px solid var(--border)',
  },
  form: {
    marginTop: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  select: {
    background: 'var(--bg)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '0.5rem',
  },
  cost: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  buildButton: {
    background: 'var(--accent)',
    color: '#080b14',
    border: 'none',
    borderRadius: '8px',
    padding: '0.7rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
};

export interface FleetProps {
  fleet: SdkFleet | null;
  onBuildUnit?: (unitType: UnitType, count: number) => void;
}

/** Shows a player's fleet composition, total power, and a unit-build form. */
export function Fleet({ fleet, onBuildUnit }: FleetProps) {
  const [unitType, setUnitType] = useState<UnitType>('Scout');
  const [count, setCount] = useState(1);

  if (!fleet) {
    return null;
  }

  const cost = getUnitCost(unitType);

  return (
    <div style={styles.panel}>
      <div style={styles.title}>Your Fleet</div>

      <div style={styles.unitGrid}>
        <div style={styles.unitCell}>
          <span style={styles.unitCount}>{fleet.scouts}</span>
          Scouts
        </div>
        <div style={styles.unitCell}>
          <span style={styles.unitCount}>{fleet.fighters}</span>
          Fighters
        </div>
        <div style={styles.unitCell}>
          <span style={styles.unitCount}>{fleet.cruisers}</span>
          Cruisers
        </div>
        <div style={styles.unitCell}>
          <span style={styles.unitCount}>{fleet.dreadnoughts}</span>
          Dreadnoughts
        </div>
      </div>

      <div style={styles.powerRow}>
        <span>Attack</span>
        <span>{calculateFleetAttack(fleet)}</span>
      </div>
      <div style={styles.powerRow}>
        <span>Defense</span>
        <span>{calculateFleetDefense(fleet)}</span>
      </div>

      {onBuildUnit && (
        <div style={styles.form}>
          <label htmlFor="fleet-unit-type">Unit type</label>
          <select
            id="fleet-unit-type"
            style={styles.select}
            value={unitType}
            onChange={(e) => setUnitType(e.target.value as UnitType)}
          >
            {UNIT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <label htmlFor="fleet-unit-count">Count</label>
          <input
            id="fleet-unit-count"
            type="number"
            min={1}
            style={styles.select}
            value={count}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
          />

          <span style={styles.cost}>
            Cost: {Number(cost.iron) * count} Iron, {Number(cost.energy) * count} Energy
          </span>

          <button style={styles.buildButton} onClick={() => onBuildUnit(unitType, count)}>
            Build
          </button>
        </div>
      )}
    </div>
  );
}
