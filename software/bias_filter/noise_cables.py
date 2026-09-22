"""Explicit distributed cable parameters for the noise circuit (SI per metre)."""
import math


def cable(p, key):
    raw = p.get('noise_cables', {}).get(key)
    if raw is None:
        return None
    result = {name: float(raw[name]) for name in ('length_m', 'r_ohm_m', 'l_nh_m', 'c_pf_m')}
    if key in ('source', 'load'):
        result['length_m'] = float(p.get(f'{key}_cable_length_m', result['length_m']))
    if not all(math.isfinite(v) for v in result.values()):
        raise ValueError('Cable parameters must be finite')
    if min(result['length_m'], result['r_ohm_m']) < 0 or min(result['l_nh_m'], result['c_pf_m']) <= 0:
        raise ValueError('Cable length and R must be nonnegative; L and C must be positive')
    return result


def model(name, c):
    return (f".model {name} LTRA(len={c['length_m']:.12g} R={c['r_ohm_m']:.12g} "
            f"L={c['l_nh_m']*1e-9:.12g} C={c['c_pf_m']*1e-12:.12g})")


def line(name, start, end, c):
    if c['length_m'] == 0:
        return [f'V{name}Bypass {start} {end} 0']
    return [f'O{name} {start} 0 {end} 0 {name}Model', model(name+'Model', c)]


def frontend_model(text, p):
    for key, name, elements in (
        ('internal', 'LMFE_SIGNAL_CABLE', ('OCASCODE', 'OFB')),
        ('head', 'LMFE_HEAD_CABLE', ('OHEAD_P', 'OHEAD_N')),
    ):
        c = cable(p, key)
        if c is None:
            continue
        rows = []
        for row in text.splitlines():
            fields = row.split()
            if row.startswith('.model '+name+' '):
                if c['length_m'] > 0:
                    rows.append(model(name, c))
            elif fields and fields[0] in elements and c['length_m'] == 0:
                rows.append(f'V{fields[0]}Bypass {fields[1]} {fields[3]} 0')
            else:
                rows.append(row)
        text = '\n'.join(rows)
    return text
