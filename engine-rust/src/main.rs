use std::collections::HashMap;
use std::env;
use std::fs::{self, File};
use std::io::{BufReader, BufWriter, Read, Write};
use std::sync::atomic::{AtomicU64, Ordering};
use std::thread;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

static BINOM: [[u32; 6]; 53] = {
    let mut table = [[0u32; 6]; 53];
    let mut n = 0usize;
    while n < 53 {
        table[n][0] = 1;
        let mut k = 1usize;
        while k <= 5 && k <= n {
            table[n][k] = table[n - 1][k - 1] + table[n - 1][k];
            k += 1;
        }
        n += 1;
    }
    table
};

fn comb_index(c: &[u8; 5]) -> usize {
    (BINOM[c[0] as usize][1]
        + BINOM[c[1] as usize][2]
        + BINOM[c[2] as usize][3]
        + BINOM[c[3] as usize][4]
        + BINOM[c[4] as usize][5]) as usize
}

fn index_to_hand(mut idx: u32) -> [u8; 5] {
    let mut cards = [0u8; 5];
    for k in (0..5u8).rev() {
        let kk = (k + 1) as usize;
        let mut c = kk as u8 - 1;
        loop {
            c += 1;
            if BINOM[c as usize][kk] > idx { break; }
        }
        c -= 1;
        cards[k as usize] = c;
        idx -= BINOM[c as usize][kk];
    }
    cards
}

fn hand_sort_key(cards: &[u8; 5]) -> u64 {
    let mut ranks = [0u8; 5];
    let mut suits = [0u8; 5];
    for i in 0..5 {
        ranks[i] = cards[i] % 13;
        suits[i] = cards[i] / 13;
    }
    ranks.sort();

    let is_flush = suits[0] == suits[1]
        && suits[1] == suits[2]
        && suits[2] == suits[3]
        && suits[3] == suits[4];

    let mut counts = [0u8; 13];
    for &r in &ranks {
        counts[r as usize] += 1;
    }

    let unique = counts.iter().filter(|&&c| c > 0).count();
    let straight_high = if unique == 5 {
        if ranks[4] - ranks[0] == 4 {
            Some(ranks[4])
        } else if ranks == [0, 1, 2, 3, 12] {
            Some(3)
        } else {
            None
        }
    } else {
        None
    };
    let is_straight = straight_high.is_some();
    let max_count = *counts.iter().max().unwrap();

    let (cat, tbs): (u8, Vec<u8>) = if is_straight && is_flush {
        (0, vec![straight_high.unwrap()])
    } else if max_count == 4 {
        let quad_r = counts.iter().rposition(|&c| c == 4).unwrap() as u8;
        let kick_r = counts.iter().rposition(|&c| c == 1).unwrap() as u8;
        (1, vec![quad_r, kick_r])
    } else if max_count == 3 && unique == 2 {
        let trip_r = counts.iter().rposition(|&c| c == 3).unwrap() as u8;
        let pair_r = counts.iter().rposition(|&c| c == 2).unwrap() as u8;
        (2, vec![trip_r, pair_r])
    } else if is_flush {
        (3, ranks.iter().rev().copied().collect())
    } else if is_straight {
        (4, vec![straight_high.unwrap()])
    } else if max_count == 3 {
        let trip_r = counts.iter().rposition(|&c| c == 3).unwrap() as u8;
        let mut tb = vec![trip_r];
        for r in (0..13).rev() {
            if counts[r] == 1 {
                tb.push(r as u8);
            }
        }
        (5, tb)
    } else if max_count == 2 && unique == 3 {
        let mut pairs: Vec<u8> = (0..13)
            .rev()
            .filter(|&r| counts[r] == 2)
            .map(|r| r as u8)
            .collect();
        let kick_r = (0..13).rev().find(|&r| counts[r] == 1).unwrap() as u8;
        pairs.push(kick_r);
        (6, pairs)
    } else if max_count == 2 {
        let pair_r = (0..13).rev().find(|&r| counts[r] == 2).unwrap() as u8;
        let mut tb = vec![pair_r];
        for r in (0..13).rev() {
            if counts[r] == 1 {
                tb.push(r as u8);
            }
        }
        (7, tb)
    } else {
        (8, ranks.iter().rev().copied().collect())
    };

    let mut key: u64 = cat as u64;
    for &t in &tbs {
        key = key * 14 + (12 - t) as u64;
    }
    for _ in tbs.len()..5 {
        key = key * 14;
    }
    key
}

fn init_eval_table() -> Vec<u16> {
    let total = BINOM[52][5] as usize;
    let mut keys_with_idx: Vec<(u64, usize)> = Vec::with_capacity(total);

    for c0 in 0u8..48 {
        for c1 in (c0 + 1)..49 {
            for c2 in (c1 + 1)..50 {
                for c3 in (c2 + 1)..51 {
                    for c4 in (c3 + 1)..52 {
                        let cards = [c0, c1, c2, c3, c4];
                        let key = hand_sort_key(&cards);
                        let idx = comb_index(&cards);
                        keys_with_idx.push((key, idx));
                    }
                }
            }
        }
    }

    let mut unique_keys: Vec<u64> = keys_with_idx.iter().map(|&(k, _)| k).collect();
    unique_keys.sort();
    unique_keys.dedup();

    let key_to_rank: HashMap<u64, u16> = unique_keys
        .iter()
        .enumerate()
        .map(|(i, &k)| (k, i as u16))
        .collect();

    let num_ranks = unique_keys.len();
    eprintln!("  Distinct hand ranks: {}", num_ranks);

    let mut table = vec![0u16; total];
    for &(key, idx) in &keys_with_idx {
        table[idx] = key_to_rank[&key];
    }
    table
}

fn canonicalize(cards: &[u8; 5]) -> [u8; 5] {
    let mut best = [255u8; 5];
    for p0 in 0..4u8 {
        for p1 in 0..4u8 {
            if p1 == p0 { continue; }
            for p2 in 0..4u8 {
                if p2 == p0 || p2 == p1 { continue; }
                let p3 = 6 - p0 - p1 - p2;
                let perm = [p0, p1, p2, p3];
                let mut mapped = [0u8; 5];
                for i in 0..5 {
                    let rank = cards[i] % 13;
                    let suit = cards[i] / 13;
                    mapped[i] = perm[suit as usize] * 13 + rank;
                }
                mapped.sort();
                if mapped < best {
                    best = mapped;
                }
            }
        }
    }
    best
}

fn enumerate_canonical() -> Vec<([u8; 5], u32)> {
    let mut map: HashMap<[u8; 5], u32> = HashMap::with_capacity(140_000);
    for c0 in 0u8..48 {
        for c1 in (c0 + 1)..49 {
            for c2 in (c1 + 1)..50 {
                for c3 in (c2 + 1)..51 {
                    for c4 in (c3 + 1)..52 {
                        let can = canonicalize(&[c0, c1, c2, c3, c4]);
                        *map.entry(can).or_insert(0) += 1;
                    }
                }
            }
        }
    }
    let mut hands: Vec<([u8; 5], u32)> = map.into_iter().collect();
    hands.sort();
    hands
}

fn two_card_subsets(hand: &[u8; 5]) -> [[u8; 2]; 10] {
    let mut subs = [[0u8; 2]; 10];
    let mut idx = 0;
    for i in 0..4 {
        for j in (i + 1)..5 {
            subs[idx] = [hand[i], hand[j]];
            idx += 1;
        }
    }
    subs
}

fn three_card_subsets(board: &[u8; 5]) -> [[u8; 3]; 10] {
    let mut subs = [[0u8; 3]; 10];
    let mut idx = 0;
    for i in 0..3 {
        for j in (i + 1)..4 {
            for k in (j + 1)..5 {
                subs[idx] = [board[i], board[j], board[k]];
                idx += 1;
            }
        }
    }
    subs
}

fn three_card_subsets_from_slice(board: &[u8]) -> [[u8; 3]; 10] {
    let mut subs = [[0u8; 3]; 10];
    let mut idx = 0;
    let n = board.len();
    for i in 0..n {
        for j in (i + 1)..n {
            for k in (j + 1)..n {
                if idx < 10 {
                    subs[idx] = [board[i], board[j], board[k]];
                    idx += 1;
                }
            }
        }
    }
    subs
}

fn merge5(a: &[u8], b: &[u8], out: &mut [u8; 5]) {
    let (mut i, mut j, mut k) = (0, 0, 0);
    while i < a.len() && j < b.len() && k < 5 {
        if a[i] <= b[j] { out[k] = a[i]; i += 1; }
        else { out[k] = b[j]; j += 1; }
        k += 1;
    }
    while i < a.len() && k < 5 { out[k] = a[i]; i += 1; k += 1; }
    while j < b.len() && k < 5 { out[k] = b[j]; j += 1; k += 1; }
}

fn eval_best(hero_2s: &[[u8; 2]; 10], board_3s: &[[u8; 3]; 10], table: &[u16]) -> u16 {
    let mut best = u16::MAX;
    let mut merged = [0u8; 5];
    for h in hero_2s {
        for b in board_3s {
            merge5(h, b, &mut merged);
            let rank = table[comb_index(&merged)];
            if rank < best {
                best = rank;
            }
        }
    }
    best
}

struct Xorshift64 { state: u64 }

impl Xorshift64 {
    fn new(seed: u64) -> Self {
        Xorshift64 { state: if seed == 0 { 1 } else { seed } }
    }
    fn next(&mut self) -> u64 {
        self.state ^= self.state << 13;
        self.state ^= self.state >> 7;
        self.state ^= self.state << 17;
        self.state
    }
    fn gen_range(&mut self, n: usize) -> usize {
        (self.next() % n as u64) as usize
    }
}

fn card_bitmap(cards: &[u8]) -> u64 {
    let mut bm: u64 = 0;
    for &c in cards { bm |= 1u64 << (c as u64); }
    bm
}

fn mix_seed(seed: u64) -> u64 {
    let mut s = seed;
    s ^= s >> 30;
    s = s.wrapping_mul(0xbf58476d1ce4e5b9);
    s ^= s >> 27;
    s = s.wrapping_mul(0x94d049bb133111eb);
    s ^= s >> 31;
    if s == 0 { 1 } else { s }
}

fn sample_villain(pool: &[u8], rng: &mut Xorshift64) -> [u8; 5] {
    let n = pool.len();
    let mut indices = [0usize; 5];
    let mut buf = [0u8; 5];
    indices[0] = rng.gen_range(n);
    for i in 1..5 {
        loop {
            let idx = rng.gen_range(n);
            let mut dup = false;
            for j in 0..i {
                if indices[j] == idx { dup = true; break; }
            }
            if !dup { indices[i] = idx; break; }
        }
    }
    for i in 0..5 { buf[i] = pool[indices[i]]; }
    buf.sort();
    buf
}

fn num_cpus() -> usize {
    std::fs::read_to_string("/proc/cpuinfo")
        .map(|s| s.matches("processor").count())
        .unwrap_or(4)
        .max(1)
}

fn card_name(card: u8) -> String {
    let ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
    let suits = ['c','d','h','s'];
    format!("{}{}", ranks[(card % 13) as usize], suits[(card / 13) as usize])
}

fn now_unix() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64
}

fn parse_flag(args: &[String], flag: &str) -> Option<String> {
    for i in 0..args.len() {
        if args[i] == flag && i + 1 < args.len() {
            return Some(args[i + 1].clone());
        }
    }
    None
}

fn run_precompute(args: &[String]) {
    let boards_str = parse_flag(args, "--boards").unwrap_or_else(|| "full".into());
    let villain_samples: u32 = parse_flag(args, "--villain-samples")
        .and_then(|s| s.parse().ok()).unwrap_or(50);
    let threads_str = parse_flag(args, "--threads").unwrap_or_else(|| "auto".into());
    let output = parse_flag(args, "--out").unwrap_or_else(|| "plo5_rankings_prod.bin".into());
    let seed: u64 = parse_flag(args, "--seed")
        .and_then(|s| s.parse().ok()).unwrap_or(12345);
    let crn_mode = parse_flag(args, "--crn")
        .map(|s| s == "on" || s == "yes" || s == "true")
        .unwrap_or(true);

    let full_enum = boards_str == "full";
    let boards_per_hero: u32 = if full_enum {
        BINOM[47][5]
    } else {
        boards_str.parse().unwrap_or_else(|_| {
            eprintln!("Invalid --boards value: {}. Use 'full' or a number of sampled boards.", boards_str);
            std::process::exit(1);
        })
    };

    let num_threads: usize = match threads_str.as_str() {
        "auto" => num_cpus(),
        s => s.parse().unwrap_or_else(|_| {
            eprintln!("Invalid --threads value: {}. Use 'auto' or a number.", s);
            std::process::exit(1);
        }),
    };

    eprintln!("╔══════════════════════════════════════════════╗");
    eprintln!("║       PLO5 Ranker — Precompute Engine        ║");
    eprintln!("╚══════════════════════════════════════════════╝");
    eprintln!();
    eprintln!("  Mode:               {}", if full_enum { "FULL ENUMERATION" } else { "RANDOM BOARD SAMPLING" });
    eprintln!("  Boards per hero:    {}", boards_per_hero);
    eprintln!("  Villain samples:    {}", villain_samples);
    eprintln!("  Seed:               {}", seed);
    eprintln!("  CRN mode:           {}", if crn_mode && !full_enum { "ON (shared board scenarios)" } else if full_enum { "N/A (full enum)" } else { "OFF (independent sampling)" });
    eprintln!("  Threads:            {}", num_threads);
    eprintln!("  Output:             {}", output);
    eprintln!();

    let t0 = Instant::now();

    eprintln!("[1/4] Initializing eval table...");
    let table = init_eval_table();
    eprintln!("       {} entries in {:.2}s", table.len(), t0.elapsed().as_secs_f64());

    eprintln!("[2/4] Enumerating canonical hands...");
    let t1 = Instant::now();
    let canonical = enumerate_canonical();
    let num_hands = canonical.len();
    let total_combos: u64 = canonical.iter().map(|(_, c)| *c as u64).sum();
    eprintln!("       {} canonical hands ({} total combos) in {:.2}s",
        num_hands, total_combos, t1.elapsed().as_secs_f64());

    let evals_per_hero = boards_per_hero as u64 * villain_samples as u64;
    let total_evals = evals_per_hero * num_hands as u64;
    eprintln!();
    eprintln!("[3/4] Computing equity...");
    eprintln!("       ALGORITHM:");
    eprintln!("         For each canonical hero hand (5 cards):");
    eprintln!("           remaining = 52 - 5 hero = 47 cards");
    if full_enum {
        eprintln!("           For EACH of C(47,5) = {} 5-card community boards:", BINOM[47][5]);
    } else {
        eprintln!("           For {} RANDOM 5-card community boards (sampled from 47):", boards_per_hero);
    }
    eprintln!("             pool = 47 - 5 board = 42 cards");
    eprintln!("             For {} random villain hands (5 cards from pool of 42):", villain_samples);
    eprintln!("               PLO5 eval: best(C(5,2) hero × C(5,3) board) = best of 100 combos");
    eprintln!("               Compare hero_rank vs villain_rank → win/lose/tie");
    eprintln!("             equity = wins / total_showdowns");
    eprintln!();
    eprintln!("       {} showdowns/hero × {} heroes = {:.2}T total showdowns",
        evals_per_hero, num_hands, total_evals as f64 / 1e12);

    struct CrnScenario {
        board: [u8; 5],
        board_bm: u64,
        villain_seeds: Vec<u64>,
    }

    let crn_active = crn_mode && !full_enum;
    let scenarios: Vec<CrnScenario> = if crn_active {
        eprintln!("       CRN: Pre-generating {} board scenarios from full 52-card deck (seed={})...", boards_per_hero, seed);
        let mut scenario_rng = Xorshift64::new(seed);
        let all52: Vec<u8> = (0..52u8).collect();
        let sc: Vec<CrnScenario> = (0..boards_per_hero).map(|_| {
            let board = sample_villain(&all52, &mut scenario_rng);
            let board_bm = card_bitmap(&board);
            let villain_seeds: Vec<u64> = (0..villain_samples)
                .map(|_| scenario_rng.next())
                .collect();
            CrnScenario { board, board_bm, villain_seeds }
        }).collect();
        eprintln!("       {} scenarios generated ({} villain seeds each).", sc.len(), villain_samples);
        eprintln!("       Expected boards/hero after filtering: ~{:.0} ({:.1}%)",
            sc.len() as f64 * 0.5902, 59.02);
        sc
    } else {
        Vec::new()
    };

    let progress = AtomicU64::new(0);
    let global_boards_total = AtomicU64::new(0);
    let global_showdowns_total = AtomicU64::new(0);
    let t2 = Instant::now();
    let chunk_size = (num_hands + num_threads - 1) / num_threads;

    let results: Vec<Vec<(f64, u64)>> = thread::scope(|s| {
        let handles: Vec<_> = (0..num_threads)
            .map(|t| {
                let table_ref = &table;
                let canonical_ref = &canonical;
                let scenarios_ref = &scenarios;
                let progress_ref = &progress;
                let boards_total_ref = &global_boards_total;
                let showdowns_total_ref = &global_showdowns_total;
                let full = full_enum;
                let bph = boards_per_hero;
                let use_crn = crn_active;
                let thread_seed = seed.wrapping_add(t as u64).wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
                s.spawn(move || {
                    let start = t * chunk_size;
                    let end = (start + chunk_size).min(num_hands);
                    let mut thread_results: Vec<(f64, u64)> = Vec::with_capacity(end - start);
                    let mut rng = Xorshift64::new(thread_seed);
                    let mut local_boards: u64 = 0;
                    let mut local_showdowns: u64 = 0;

                    for i in start..end {
                        let hero = &canonical_ref[i].0;
                        let hero_2s = two_card_subsets(hero);

                        let mut equity_sum = 0.0f64;
                        let mut count = 0u64;

                        if use_crn {
                            let hero_bm = card_bitmap(hero);
                            for sc in scenarios_ref.iter() {
                                if (hero_bm & sc.board_bm) != 0 { continue; }
                                local_boards += 1;

                                let board_3s = three_card_subsets(&sc.board);
                                let hero_rank = eval_best(&hero_2s, &board_3s, table_ref);

                                let combined_bm = hero_bm | sc.board_bm;
                                let pool: Vec<u8> = (0..52u8)
                                    .filter(|c| (combined_bm >> (*c as u64)) & 1 == 0)
                                    .collect();

                                for &vseed in &sc.villain_seeds {
                                    let mut vrng = Xorshift64::new(mix_seed(vseed));
                                    let villain = sample_villain(&pool, &mut vrng);
                                    let villain_2s = two_card_subsets(&villain);
                                    let villain_rank = eval_best(&villain_2s, &board_3s, table_ref);
                                    if hero_rank < villain_rank {
                                        equity_sum += 1.0;
                                    } else if hero_rank == villain_rank {
                                        equity_sum += 0.5;
                                    }
                                    count += 1;
                                    local_showdowns += 1;
                                }
                            }
                        } else if full {
                            let remaining: Vec<u8> = (0..52u8).filter(|c| !hero.contains(c)).collect();
                            let rem_len = remaining.len();
                            for b0 in 0..(rem_len - 4) {
                                for b1 in (b0 + 1)..(rem_len - 3) {
                                    for b2 in (b1 + 1)..(rem_len - 2) {
                                        for b3 in (b2 + 1)..(rem_len - 1) {
                                            for b4 in (b3 + 1)..rem_len {
                                                local_boards += 1;
                                                let mut board = [
                                                    remaining[b0], remaining[b1], remaining[b2],
                                                    remaining[b3], remaining[b4],
                                                ];
                                                board.sort();
                                                let board_3s = three_card_subsets(&board);
                                                let hero_rank = eval_best(&hero_2s, &board_3s, table_ref);

                                                let mut pool = Vec::with_capacity(42);
                                                for idx in 0..rem_len {
                                                    if idx != b0 && idx != b1 && idx != b2 && idx != b3 && idx != b4 {
                                                        pool.push(remaining[idx]);
                                                    }
                                                }

                                                for _ in 0..villain_samples {
                                                    let villain = sample_villain(&pool, &mut rng);
                                                    let villain_2s = two_card_subsets(&villain);
                                                    let villain_rank = eval_best(&villain_2s, &board_3s, table_ref);
                                                    if hero_rank < villain_rank {
                                                        equity_sum += 1.0;
                                                    } else if hero_rank == villain_rank {
                                                        equity_sum += 0.5;
                                                    }
                                                    count += 1;
                                                    local_showdowns += 1;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            let remaining: Vec<u8> = (0..52u8).filter(|c| !hero.contains(c)).collect();
                            for _ in 0..bph {
                                local_boards += 1;
                                let board = sample_villain(&remaining, &mut rng);
                                let mut sorted_board = board;
                                sorted_board.sort();
                                let board_3s = three_card_subsets(&sorted_board);
                                let hero_rank = eval_best(&hero_2s, &board_3s, table_ref);

                                let pool: Vec<u8> = remaining.iter()
                                    .copied().filter(|c| !board.contains(c)).collect();

                                for _ in 0..villain_samples {
                                    let villain = sample_villain(&pool, &mut rng);
                                    let villain_2s = two_card_subsets(&villain);
                                    let villain_rank = eval_best(&villain_2s, &board_3s, table_ref);
                                    if hero_rank < villain_rank {
                                        equity_sum += 1.0;
                                    } else if hero_rank == villain_rank {
                                        equity_sum += 0.5;
                                    }
                                    count += 1;
                                    local_showdowns += 1;
                                }
                            }
                        }

                        thread_results.push((equity_sum, count));
                        let done = progress_ref.fetch_add(1, Ordering::Relaxed) + 1;
                        if done % 1000 == 0 || done == num_hands as u64 {
                            let elapsed = t2.elapsed().as_secs_f64();
                            let rate = done as f64 / elapsed;
                            let eta = (num_hands as f64 - done as f64) / rate;
                            let eta_h = (eta / 3600.0) as u32;
                            let eta_m = ((eta % 3600.0) / 60.0) as u32;
                            let eta_s = (eta % 60.0) as u32;
                            eprint!(
                                "\r       Progress: {}/{} ({:.1}%) ETA: {}h{:02}m{:02}s   ",
                                done, num_hands,
                                done as f64 / num_hands as f64 * 100.0,
                                eta_h, eta_m, eta_s
                            );
                        }
                    }
                    boards_total_ref.fetch_add(local_boards, Ordering::Relaxed);
                    showdowns_total_ref.fetch_add(local_showdowns, Ordering::Relaxed);
                    thread_results
                })
            })
            .collect();
        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });

    eprintln!();
    let compute_elapsed = t2.elapsed().as_secs_f64();
    let compute_h = (compute_elapsed / 3600.0) as u32;
    let compute_m = ((compute_elapsed % 3600.0) / 60.0) as u32;
    let compute_s = (compute_elapsed % 60.0) as u32;
    eprintln!("       Done in {}h{:02}m{:02}s ({:.1}s)", compute_h, compute_m, compute_s, compute_elapsed);

    let boards_total = global_boards_total.load(Ordering::Relaxed);
    let showdowns_total = global_showdowns_total.load(Ordering::Relaxed);

    let all_results: Vec<(f64, u64)> = results.into_iter().flatten().collect();

    eprintln!();
    eprintln!("[4/4] Writing output...");

    let mut entries: Vec<(usize, f64, u64)> = Vec::with_capacity(num_hands);
    let mut min_samples = u64::MAX;
    let mut max_samples = 0u64;
    let mut sum_samples = 0u64;

    for (i, &(eq_sum, cnt)) in all_results.iter().enumerate() {
        let eq = if cnt > 0 { eq_sum / cnt as f64 } else { 0.5 };
        entries.push((i, eq, cnt));
        min_samples = min_samples.min(cnt);
        max_samples = max_samples.max(cnt);
        sum_samples += cnt;
    }

    let avg_samples = if num_hands > 0 { sum_samples / num_hands as u64 } else { 0 };
    entries.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

    let timestamp = now_unix();

    let mut f = BufWriter::new(File::create(&output).unwrap());
    f.write_all(b"PLO5").unwrap();
    f.write_all(&2u32.to_le_bytes()).unwrap();
    f.write_all(&(num_hands as u32).to_le_bytes()).unwrap();
    f.write_all(&boards_per_hero.to_le_bytes()).unwrap();
    f.write_all(&villain_samples.to_le_bytes()).unwrap();
    f.write_all(&(avg_samples as u32).to_le_bytes()).unwrap();
    f.write_all(&(min_samples as u32).to_le_bytes()).unwrap();
    f.write_all(&(max_samples as u32).to_le_bytes()).unwrap();
    f.write_all(&timestamp.to_le_bytes()).unwrap();
    f.write_all(&[0u8; 24]).unwrap();

    for (rank_idx, &(orig_idx, equity, _)) in entries.iter().enumerate() {
        let hand = &canonical[orig_idx];
        f.write_all(&hand.0).unwrap();
        let combo = hand.1.min(255) as u8;
        f.write_all(&[combo]).unwrap();
        f.write_all(&(equity as f32).to_le_bytes()).unwrap();
        f.write_all(&((rank_idx + 1) as u32).to_le_bytes()).unwrap();
        let percentile = (1.0 - rank_idx as f32 / (num_hands - 1) as f32) * 100.0;
        f.write_all(&percentile.to_le_bytes()).unwrap();
        f.write_all(&[0u8; 2]).unwrap();
    }

    let file_size = 64 + num_hands * 20;

    eprintln!();
    let total_elapsed = t0.elapsed().as_secs_f64();
    let showdowns_per_sec = if compute_elapsed > 0.0 { showdowns_total as f64 / compute_elapsed } else { 0.0 };

    eprintln!("╔══════════════════════════════════════════════╗");
    eprintln!("║              Precompute Complete              ║");
    eprintln!("╚══════════════════════════════════════════════╝");
    eprintln!("  Output:                    {}", output);
    eprintln!("  File size:                 {:.2} MB ({} bytes)", file_size as f64 / 1e6, file_size);
    eprintln!();
    eprintln!("  ── HARD COUNTERS ──────────────────────────");
    eprintln!("  heroes_processed:          {}", num_hands);
    eprintln!("  boards_processed_total:    {}", boards_total);
    eprintln!("  boards_per_hero_average:   {}", if num_hands > 0 { boards_total / num_hands as u64 } else { 0 });
    eprintln!("  villain_samples_per_board: {}", villain_samples);
    eprintln!("  villain_samples_total:     {}", showdowns_total);
    eprintln!("  total_showdown_evals:      {}", showdowns_total);
    eprintln!("  seed:                      {}", seed);
    eprintln!("  crn_mode:                  {}", if crn_active { "ON" } else { "OFF" });
    if crn_active {
        eprintln!("  crn_scenarios_generated:   {}", scenarios.len());
    }
    eprintln!("  elapsed_seconds:           {:.2}", total_elapsed);
    eprintln!("  compute_seconds:           {:.2}", compute_elapsed);
    eprintln!("  showdowns_per_second:      {:.0}", showdowns_per_sec);
    eprintln!();
    eprintln!("  ── EQUITY STATS ──────────────────────────");
    eprintln!("  Avg samples/hero:          {}", avg_samples);
    eprintln!("  Min samples/hero:          {}", min_samples);
    eprintln!("  Max samples/hero:          {}", max_samples);

    let top5: Vec<String> = entries.iter().take(5).map(|&(idx, eq, _)| {
        let h = &canonical[idx].0;
        let names: Vec<String> = h.iter().map(|&c| card_name(c)).collect();
        format!("    #{}: {} = {:.3}%", entries.iter().position(|e| e.0 == idx).unwrap() + 1, names.join(""), eq * 100.0)
    }).collect();
    eprintln!();
    eprintln!("  Top 5 hands:");
    for s in &top5 { eprintln!("{}", s); }
}

fn run_baseline(args: &[String]) {
    let output = parse_flag(args, "--out").unwrap_or_else(|| "baseline.json".into());
    let num_baseline: usize = parse_flag(args, "--hands")
        .and_then(|s| s.parse().ok()).unwrap_or(300);
    let trials: u32 = parse_flag(args, "--trials")
        .and_then(|s| s.parse().ok()).unwrap_or(5_000_000);

    let t0 = Instant::now();
    eprintln!("Initializing eval table...");
    let table = init_eval_table();

    eprintln!("Enumerating canonical hands...");
    let canonical = enumerate_canonical();
    let num_hands = canonical.len();

    let step = num_hands / num_baseline;
    let indices: Vec<usize> = (0..num_baseline).map(|i| i * step).collect();
    eprintln!("Generating baselines for {} hands with {} trials each", indices.len(), trials);

    let num_threads = num_cpus();
    let chunk_size = (indices.len() + num_threads - 1) / num_threads;

    let results: Vec<Vec<([u8; 5], f64)>> = thread::scope(|s| {
        let handles: Vec<_> = (0..num_threads)
            .map(|t| {
                let table_ref = &table;
                let canonical_ref = &canonical;
                let indices_ref = &indices;
                s.spawn(move || {
                    let start = t * chunk_size;
                    let end = (start + chunk_size).min(indices_ref.len());
                    let mut thread_results = Vec::new();
                    let mut rng = Xorshift64::new((t as u64 + 1) * 2862933555777941757);

                    for &hi in &indices_ref[start..end] {
                        let hero = &canonical_ref[hi].0;
                        let hero_2s = two_card_subsets(hero);
                        let remaining: Vec<u8> = (0..52u8).filter(|c| !hero.contains(c)).collect();

                        let mut wins = 0.0f64;
                        let mut total = 0u32;

                        for _ in 0..trials {
                            let board = sample_villain(&remaining, &mut rng);
                            let mut sorted_board = board;
                            sorted_board.sort();
                            let board_3s = three_card_subsets(&sorted_board);
                            let hero_rank = eval_best(&hero_2s, &board_3s, table_ref);

                            let villain_pool: Vec<u8> = remaining.iter()
                                .copied().filter(|c| !board.contains(c)).collect();
                            let villain = sample_villain(&villain_pool, &mut rng);
                            let villain_2s = two_card_subsets(&villain);
                            let villain_rank = eval_best(&villain_2s, &board_3s, table_ref);

                            if hero_rank < villain_rank { wins += 1.0; }
                            else if hero_rank == villain_rank { wins += 0.5; }
                            total += 1;
                        }

                        let equity = wins / total as f64;
                        thread_results.push((*hero, equity));
                        eprintln!("  Baseline {}: equity={:.4}%", hi, equity * 100.0);
                    }
                    thread_results
                })
            })
            .collect();
        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });

    let all_results: Vec<([u8; 5], f64)> = results.into_iter().flatten().collect();
    let mut f = BufWriter::new(File::create(&output).unwrap());
    write!(f, "{{\"baselines\":[").unwrap();
    for (i, (hand, eq)) in all_results.iter().enumerate() {
        if i > 0 { write!(f, ",").unwrap(); }
        write!(f, "{{\"cards\":[{},{},{},{},{}],\"equity\":{}}}", hand[0], hand[1], hand[2], hand[3], hand[4], eq).unwrap();
    }
    write!(f, "],\"trials\":{}}}", trials).unwrap();
    eprintln!("Baselines written to {} ({} hands, {:.1}s)", output, all_results.len(), t0.elapsed().as_secs_f64());
}

fn run_validate(args: &[String]) {
    let bin_path = parse_flag(args, "--bin").unwrap_or_else(|| "plo5_rankings_prod.bin".into());
    let baseline_path = parse_flag(args, "--baseline").unwrap_or_else(|| "baseline.json".into());

    eprintln!("Loading engine results from {}...", bin_path);
    let bin_data = fs::read(&bin_path).unwrap();
    assert!(bin_data.len() >= 64, "File too small");
    assert_eq!(&bin_data[0..4], b"PLO5", "Invalid magic");

    let num_hands = u32::from_le_bytes(bin_data[8..12].try_into().unwrap()) as usize;
    let boards = u32::from_le_bytes(bin_data[12..16].try_into().unwrap());
    let v_samples = u32::from_le_bytes(bin_data[16..20].try_into().unwrap());
    let avg_samples = u32::from_le_bytes(bin_data[20..24].try_into().unwrap());

    let mut engine_map: HashMap<[u8; 5], f64> = HashMap::new();
    for i in 0..num_hands {
        let off = 64 + i * 20;
        let cards: [u8; 5] = bin_data[off..off + 5].try_into().unwrap();
        let equity = f32::from_le_bytes(bin_data[off + 6..off + 10].try_into().unwrap()) as f64;
        engine_map.insert(cards, equity);
    }

    eprintln!("Loading baselines from {}...", baseline_path);
    let baseline_str = fs::read_to_string(&baseline_path).unwrap();
    let baselines = parse_baselines(&baseline_str);

    let mut errors: Vec<f64> = Vec::new();
    let mut missing = 0;
    for (cards, baseline_eq) in &baselines {
        if let Some(&engine_eq) = engine_map.get(cards) {
            let err = (engine_eq - baseline_eq).abs() * 100.0;
            errors.push(err);
        } else {
            missing += 1;
        }
    }

    errors.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let n = errors.len();
    if n == 0 {
        println!("No baselines matched. Check encoding compatibility.");
        return;
    }
    let max_err = errors.last().copied().unwrap_or(0.0);
    let p95_err = errors[((n as f64 * 0.95) as usize).min(n - 1)];
    let mean_err = errors.iter().sum::<f64>() / n as f64;

    println!();
    println!("╔══════════════════════════════════════════════╗");
    println!("║            Validation Report                  ║");
    println!("╚══════════════════════════════════════════════╝");
    println!("  Engine:     {} hands, {} boards/hero, V={}, avg {} samples", num_hands, boards, v_samples, avg_samples);
    println!("  Baselines:  {} compared, {} missing", n, missing);
    println!("  Max error:  {:.4}%", max_err);
    println!("  P95 error:  {:.4}%", p95_err);
    println!("  Mean error: {:.4}%", mean_err);
    println!("  Status:     {}", if max_err <= 0.10 { "✓ PASS" } else { "✗ FAIL" });
}

fn parse_baselines(json: &str) -> Vec<([u8; 5], f64)> {
    let mut results = Vec::new();
    let mut pos = 0;
    while pos < json.len() {
        if let Some(cards_start) = json[pos..].find("\"cards\":[") {
            let start = pos + cards_start + 9;
            if let Some(end_bracket) = json[start..].find(']') {
                let cards_str = &json[start..start + end_bracket];
                let nums: Vec<u8> = cards_str.split(',')
                    .filter_map(|s| s.trim().parse().ok()).collect();
                if nums.len() == 5 {
                    let cards: [u8; 5] = [nums[0], nums[1], nums[2], nums[3], nums[4]];
                    let eq_start = start + end_bracket;
                    if let Some(eq_pos) = json[eq_start..].find("\"equity\":") {
                        let val_start = eq_start + eq_pos + 9;
                        let val_end = json[val_start..].find(|c: char| c == ',' || c == '}')
                            .unwrap_or(json.len() - val_start);
                        let eq: f64 = json[val_start..val_start + val_end].trim().parse().unwrap_or(0.0);
                        results.push((cards, eq));
                    }
                }
                pos = start + end_bracket;
            } else { break; }
        } else { break; }
    }
    results
}

fn parse_cards_vec(s: &str) -> Vec<u8> {
    let ranks = "23456789TJQKA";
    let suits = "cdhs";
    let s = s.trim();
    let mut cards = Vec::new();
    let mut i = 0;
    let bytes = s.as_bytes();
    while i < bytes.len() {
        let r_ch = bytes[i] as char;
        if let Some(r) = ranks.find(r_ch) {
            if i + 1 < bytes.len() {
                let s_ch = bytes[i + 1] as char;
                if let Some(su) = suits.find(s_ch) {
                    cards.push((su as u8) * 13 + r as u8);
                    i += 2;
                    continue;
                }
            }
        }
        i += 1;
    }
    cards
}

fn parse_hand(s: &str) -> Option<[u8; 5]> {
    let cards = parse_cards_vec(s);
    if cards.len() == 5 {
        let mut arr = [cards[0], cards[1], cards[2], cards[3], cards[4]];
        arr.sort();
        Some(arr)
    } else {
        None
    }
}

fn sample_n(pool: &[u8], n: usize, rng: &mut Xorshift64) -> Vec<u8> {
    let plen = pool.len();
    let mut indices = Vec::with_capacity(n);
    for _ in 0..n {
        loop {
            let idx = rng.gen_range(plen);
            let mut dup = false;
            for &prev in &indices {
                if prev == idx { dup = true; break; }
            }
            if !dup { indices.push(idx); break; }
        }
    }
    indices.iter().map(|&i| pool[i]).collect()
}

fn run_accuracy(args: &[String]) {
    let bin_path = parse_flag(args, "--bin").unwrap_or_else(|| "plo5_rankings_prod.bin".into());
    let trials: u64 = parse_flag(args, "--trials")
        .and_then(|s| s.parse().ok()).unwrap_or(2_000_000);

    let test_hands_str: Vec<String> = if let Some(hands_arg) = parse_flag(args, "--test-hands") {
        hands_arg.split(',').map(|s| s.trim().to_string()).collect()
    } else {
        vec![
            "AcAdAhKsQs".into(),
            "AcAdKcKdQh".into(),
            "AcAdKhQhJh".into(),
            "KcKdKhQsJs".into(),
            "JcTc9c8c7c".into(),
            "AcKcQcJcTd".into(),
            "2c3c4d5d7h".into(),
            "AcAd2s3s4h".into(),
            "TcTd9h8h7s".into(),
            "6c6d5h4h3s".into(),
        ]
    };

    eprintln!("╔══════════════════════════════════════════════╗");
    eprintln!("║       PLO5 Accuracy Benchmark                ║");
    eprintln!("╚══════════════════════════════════════════════╝");
    eprintln!("  Binary:  {}", bin_path);
    eprintln!("  Trials:  {} per hand (unbiased MC)", trials);
    eprintln!();

    let t0 = Instant::now();
    eprintln!("[1/3] Initializing eval table...");
    let table = init_eval_table();
    eprintln!("       Done in {:.2}s", t0.elapsed().as_secs_f64());

    eprintln!("[2/3] Loading engine results from binary...");
    let bin_data = fs::read(&bin_path).unwrap();
    assert!(bin_data.len() >= 64, "File too small");
    assert_eq!(&bin_data[0..4], b"PLO5", "Invalid magic");
    let num_hands = u32::from_le_bytes(bin_data[8..12].try_into().unwrap()) as usize;
    let boards_in_file = u32::from_le_bytes(bin_data[12..16].try_into().unwrap());
    let v_samples_in_file = u32::from_le_bytes(bin_data[16..20].try_into().unwrap());

    let mut engine_map: HashMap<[u8; 5], f64> = HashMap::new();
    for i in 0..num_hands {
        let off = 64 + i * 20;
        let cards: [u8; 5] = bin_data[off..off + 5].try_into().unwrap();
        let equity = f32::from_le_bytes(bin_data[off + 6..off + 10].try_into().unwrap()) as f64;
        engine_map.insert(cards, equity);
    }
    eprintln!("       {} hands loaded (boards={}, V={})", num_hands, boards_in_file, v_samples_in_file);

    eprintln!("[3/3] Running unbiased MC for {} hands...", test_hands_str.len());
    eprintln!();

    let mut test_hands: Vec<([u8; 5], String)> = Vec::new();
    for s in &test_hands_str {
        if let Some(h) = parse_hand(s.as_str()) {
            let can = canonicalize(&h);
            test_hands.push((can, s.clone()));
        } else {
            eprintln!("  WARNING: Could not parse hand '{}'", s);
        }
    }

    let num_threads = num_cpus();

    eprintln!("  {:>3}  {:<14}  {:>10}  {:>10}  {:>8}", "#", "Hand", "Engine%", "MC_2M%", "Delta%");
    eprintln!("  ───  ──────────────  ──────────  ──────────  ────────");

    let mut max_delta = 0.0f64;

    for (idx, (canonical_hand, label)) in test_hands.iter().enumerate() {
        let hero = *canonical_hand;
        let hero_2s = two_card_subsets(&hero);
        let remaining: Vec<u8> = (0..52u8).filter(|c| !hero.contains(c)).collect();

        let chunk = (trials as usize + num_threads - 1) / num_threads;
        let mc_equity: f64 = thread::scope(|s| {
            let handles: Vec<_> = (0..num_threads).map(|t| {
                let table_ref = &table;
                let hero_2s_ref = &hero_2s;
                let remaining_ref = &remaining;
                s.spawn(move || {
                    let start = t * chunk;
                    let end = ((t + 1) * chunk).min(trials as usize);
                    let mut rng = Xorshift64::new(
                        (t as u64 + 42 + idx as u64).wrapping_mul(6364136223846793005).wrapping_add(1)
                    );
                    let mut wins = 0.0f64;
                    let mut total = 0u64;
                    for _ in start..end {
                        let board = sample_villain(remaining_ref, &mut rng);
                        let mut sorted_board = board;
                        sorted_board.sort();
                        let board_3s = three_card_subsets(&sorted_board);
                        let hero_rank = eval_best(hero_2s_ref, &board_3s, table_ref);

                        let pool: Vec<u8> = remaining_ref.iter()
                            .copied().filter(|c| !board.contains(c)).collect();
                        let villain = sample_villain(&pool, &mut rng);
                        let villain_2s = two_card_subsets(&villain);
                        let villain_rank = eval_best(&villain_2s, &board_3s, table_ref);

                        if hero_rank < villain_rank { wins += 1.0; }
                        else if hero_rank == villain_rank { wins += 0.5; }
                        total += 1;
                    }
                    (wins, total)
                })
            }).collect();
            let (total_wins, total_count): (f64, u64) = handles.into_iter()
                .map(|h| h.join().unwrap())
                .fold((0.0, 0), |(w, c), (w2, c2)| (w + w2, c + c2));
            total_wins / total_count as f64
        });

        let engine_eq = engine_map.get(canonical_hand).copied().unwrap_or(f64::NAN);
        let delta = (engine_eq - mc_equity) * 100.0;
        max_delta = max_delta.max(delta.abs());

        eprintln!("  {:>3}  {:<14}  {:>9.3}%  {:>9.3}%  {:>+7.3}%",
            idx + 1, label, engine_eq * 100.0, mc_equity * 100.0, delta);
    }

    eprintln!();
    eprintln!("  Max |delta|: {:.3}%", max_delta);
    eprintln!("  Target:      <= 0.15%");
    eprintln!("  Status:      {}", if max_delta <= 0.15 { "PASS" } else { "FAIL" });
    eprintln!("  Total time:  {:.1}s", t0.elapsed().as_secs_f64());
}

fn run_info() {
    let t0 = Instant::now();
    eprintln!("PLO5 Ranker Engine v2.0");
    eprintln!();

    eprintln!("Enumerating canonical hands...");
    let canonical = enumerate_canonical();
    let total_combos: u64 = canonical.iter().map(|(_, c)| *c as u64).sum();
    eprintln!("  {} canonical hands in {:.1}s", canonical.len(), t0.elapsed().as_secs_f64());
    eprintln!("  Total combos: {} (expected 2598960)", total_combos);
    eprintln!("  Boards per hero: C(47,5) = {}", BINOM[47][5]);
    eprintln!("  CPUs detected: {}", num_cpus());

    let t1 = Instant::now();
    eprintln!();
    eprintln!("Initializing eval table...");
    let table = init_eval_table();
    eprintln!("  {} entries in {:.1}s", table.len(), t1.elapsed().as_secs_f64());

    let test_hands: Vec<([u8; 5], &str)> = vec![
        ([8, 9, 10, 11, 12], "Royal Flush (clubs)"),
        ([21, 22, 23, 24, 25], "Royal Flush (diamonds)"),
        ([0, 13, 26, 39, 12], "Four 2s + Ace"),
    ];
    eprintln!();
    for (h, desc) in &test_hands {
        let rank = table[comb_index(h)];
        let names: Vec<String> = h.iter().map(|&c| card_name(c)).collect();
        eprintln!("  {} ({}) → rank {}", names.join(" "), desc, rank);
    }

    let bin_path = "public/plo5_rankings_prod.bin";
    if std::path::Path::new(bin_path).exists() {
        eprintln!();
        print_bin_info(bin_path);
    }
}

fn print_bin_info(path: &str) {
    let data = fs::read(path).unwrap();
    if data.len() < 64 || &data[0..4] != b"PLO5" {
        eprintln!("  Invalid binary file: {}", path);
        return;
    }
    let version = u32::from_le_bytes(data[4..8].try_into().unwrap());
    let num_hands = u32::from_le_bytes(data[8..12].try_into().unwrap());
    let boards = u32::from_le_bytes(data[12..16].try_into().unwrap());
    let v_samples = u32::from_le_bytes(data[16..20].try_into().unwrap());
    let avg = u32::from_le_bytes(data[20..24].try_into().unwrap());
    let min = u32::from_le_bytes(data[24..28].try_into().unwrap());
    let max = u32::from_le_bytes(data[28..32].try_into().unwrap());
    let ts = i64::from_le_bytes(data[32..40].try_into().unwrap());

    eprintln!("Production binary: {}", path);
    eprintln!("  Version:         {}", version);
    eprintln!("  Hands:           {}", num_hands);
    eprintln!("  Boards/hero:     {}", boards);
    eprintln!("  Villain samples: {}", v_samples);
    eprintln!("  Avg samples:     {}", avg);
    eprintln!("  Min samples:     {}", min);
    eprintln!("  Max samples:     {}", max);
    eprintln!("  Timestamp:       {}", ts);
    eprintln!("  File size:       {} bytes ({:.2} MB)", data.len(), data.len() as f64 / 1e6);
}

fn load_rank_index(path: &str) -> Vec<u32> {
    let data = fs::read(path).unwrap_or_else(|e| {
        eprintln!("Cannot read rank index file '{}': {}", path, e);
        std::process::exit(1);
    });
    let expected = 2598960 * 4;
    if data.len() != expected {
        eprintln!("Rank index file size mismatch: got {} bytes, expected {}", data.len(), expected);
        std::process::exit(1);
    }
    let mut indices = vec![0u32; 2598960];
    for i in 0..2598960 {
        indices[i] = u32::from_le_bytes(data[i*4..(i+1)*4].try_into().unwrap());
    }
    indices
}

fn parse_villain_range(s: &str) -> Option<f64> {
    let s = s.trim().to_lowercase();
    if s == "100%" { return Some(100.0); }
    if s.starts_with("top") { return None; }
    let s = s.strip_suffix('%')?;
    s.parse::<f64>().ok().filter(|&v| v > 0.0 && v <= 100.0)
}

fn run_equity(args: &[String]) {
    let hand_str = parse_flag(args, "--hand").unwrap_or_else(|| {
        eprintln!("Usage: plo5_ranker equity --hand <hand> [--board <cards>] [--dead <cards>] [--trials N] [--seed S] [--json] [--villain-range 100%|N%] [--rank-file path]");
        eprintln!("Example: plo5_ranker equity --hand AcAdKhQh5s --trials 600000 --seed 12345 --json");
        eprintln!("Example: plo5_ranker equity --hand AcAdKhQh5s --villain-range 10% --rank-file rank_index_all_2598960.u32 --json");
        std::process::exit(1);
    });
    let trials: u64 = parse_flag(args, "--trials")
        .and_then(|s| s.parse().ok()).unwrap_or(600_000);
    let seed: u64 = parse_flag(args, "--seed")
        .and_then(|s| s.parse().ok()).unwrap_or(12345);
    let json_output = args.iter().any(|a| a == "--json");

    let board_str = parse_flag(args, "--board").unwrap_or_default();
    let dead_str = parse_flag(args, "--dead").unwrap_or_default();
    let villain_range_str = parse_flag(args, "--villain-range").unwrap_or_else(|| "100%".into());
    let rank_file = parse_flag(args, "--rank-file").unwrap_or_else(|| "public/rank_index_all_2598960.u32".into());

    let villain_pct = parse_villain_range(&villain_range_str).unwrap_or_else(|| {
        if json_output {
            println!("{{\"ok\":false,\"error\":\"Invalid villain range: '{}'. Use N% (e.g. 10%, 20%, 100%)\"}}", villain_range_str);
            std::process::exit(0);
        }
        eprintln!("Invalid villain range: '{}'. Use N% (e.g. 10%, 20%, 100%)", villain_range_str);
        std::process::exit(1);
    });
    let is_range_restricted = villain_pct < 100.0;

    let hand = parse_hand(&hand_str).unwrap_or_else(|| {
        if json_output {
            println!("{{\"ok\":false,\"error\":\"Could not parse hand: {} (need exactly 5 cards)\"}}", hand_str);
            std::process::exit(0);
        }
        eprintln!("Could not parse hand: {}", hand_str);
        std::process::exit(1);
    });

    let board_cards = parse_cards_vec(&board_str);
    let dead_cards = parse_cards_vec(&dead_str);

    if !board_cards.is_empty() && board_cards.len() != 3 && board_cards.len() != 4 && board_cards.len() != 5 {
        if json_output {
            println!("{{\"ok\":false,\"error\":\"Board must have 0, 3, 4, or 5 cards (got {})\"}}", board_cards.len());
            std::process::exit(0);
        }
        eprintln!("Board must have 0, 3, 4, or 5 cards (got {})", board_cards.len());
        std::process::exit(1);
    }

    let mut excluded: Vec<u8> = Vec::new();
    for &c in hand.iter() { excluded.push(c); }
    for &c in &board_cards { excluded.push(c); }
    for &c in &dead_cards { excluded.push(c); }
    excluded.sort();
    excluded.dedup();
    if excluded.len() != hand.len() + board_cards.len() + dead_cards.len() {
        if json_output {
            println!("{{\"ok\":false,\"error\":\"Duplicate cards found among hand, board, and dead cards\"}}");
            std::process::exit(0);
        }
        eprintln!("Duplicate cards found among hand, board, and dead cards");
        std::process::exit(1);
    }

    let canonical = canonicalize(&hand);
    let card_names: Vec<String> = canonical.iter().map(|&c| card_name(c)).collect();
    let board_to_fill = 5 - board_cards.len();

    let debug_mode = args.iter().any(|a| a == "--debug");
    let rank_pool: Vec<[u8; 5]> = if is_range_restricted {
        let rank_index = load_rank_index(&rank_file);
        let top_count = ((villain_pct / 100.0) * 2598960.0).ceil() as usize;
        let top_count = top_count.min(2598960);
        if !json_output {
            eprintln!("  Villain range: top {:.1}% ({} of 2,598,960 hands)", villain_pct, top_count);
        }
        let pool: Vec<[u8; 5]> = rank_index[..top_count].iter().map(|&idx| index_to_hand(idx)).collect();
        if debug_mode || !json_output {
            eprintln!("  DEBUG: rank_index[0] (best)  = {} → {}", rank_index[0],
                pool[0].iter().map(|&c| card_name(c)).collect::<Vec<_>>().join(""));
            eprintln!("  DEBUG: rank_index[{}] (cutoff) = {} → {}", top_count-1, rank_index[top_count-1],
                pool[top_count-1].iter().map(|&c| card_name(c)).collect::<Vec<_>>().join(""));
            if top_count < rank_index.len() {
                let next_hand = index_to_hand(rank_index[top_count]);
                eprintln!("  DEBUG: rank_index[{}] (first excluded) = {} → {}", top_count, rank_index[top_count],
                    next_hand.iter().map(|&c| card_name(c)).collect::<Vec<_>>().join(""));
            }
            eprintln!("  DEBUG: Top 5 hands in pool:");
            for i in 0..5.min(top_count) {
                eprintln!("    #{}: idx={} → {}", i+1, rank_index[i],
                    pool[i].iter().map(|&c| card_name(c)).collect::<Vec<_>>().join(""));
            }
            eprintln!("  DEBUG: Last 5 hands in pool (near cutoff):");
            for i in (top_count.saturating_sub(5))..top_count {
                eprintln!("    #{}: idx={} → {}", i+1, rank_index[i],
                    pool[i].iter().map(|&c| card_name(c)).collect::<Vec<_>>().join(""));
            }
        }
        pool
    } else {
        Vec::new()
    };

    if !json_output {
        eprintln!("╔══════════════════════════════════════════════╗");
        eprintln!("║       PLO5 Single-Hand Equity (PPT-style)    ║");
        eprintln!("╚══════════════════════════════════════════════╝");
        eprintln!("  Hand:    {} → canonical: {}", hand_str, card_names.join(""));
        if !board_cards.is_empty() {
            let bn: Vec<String> = board_cards.iter().map(|&c| card_name(c)).collect();
            eprintln!("  Board:   {}", bn.join(""));
        }
        if !dead_cards.is_empty() {
            let dn: Vec<String> = dead_cards.iter().map(|&c| card_name(c)).collect();
            eprintln!("  Dead:    {}", dn.join(""));
        }
        eprintln!("  Villain: {}", villain_range_str);
        eprintln!("  Trials:  {}", trials);
        eprintln!("  Seed:    {}", seed);
        eprintln!();
    }

    let t0 = Instant::now();
    if !json_output { eprintln!("[1/2] Initializing eval table..."); }
    let table = init_eval_table();
    if !json_output { eprintln!("       Done in {:.2}s", t0.elapsed().as_secs_f64()); }

    if !json_output { eprintln!("[2/2] Running deterministic MC..."); }
    let hero_2s = two_card_subsets(&hand);
    let hero_bm = card_bitmap(&hand);
    let remaining: Vec<u8> = (0..52u8).filter(|c| !excluded.contains(c)).collect();

    let num_threads = num_cpus();
    let chunk = (trials as usize + num_threads - 1) / num_threads;

    let (mc_equity, total_wins_f, total_count_u): (f64, f64, u64) = thread::scope(|s| {
        let handles: Vec<_> = (0..num_threads).map(|t| {
            let table_ref = &table;
            let hero_2s_ref = &hero_2s;
            let remaining_ref = &remaining;
            let board_cards_ref = &board_cards;
            let board_fill_n = board_to_fill;
            let rank_pool_ref = &rank_pool;
            let use_range = is_range_restricted;
            s.spawn(move || {
                let start = t * chunk;
                let end = ((t + 1) * chunk).min(trials as usize);
                let mut rng = Xorshift64::new(
                    mix_seed(seed.wrapping_add(t as u64))
                );
                let mut wins = 0.0f64;
                let mut total = 0u64;
                for _ in start..end {
                    let board_sample = sample_n(remaining_ref, board_fill_n, &mut rng);
                    let mut full_board = Vec::with_capacity(5);
                    for &c in board_cards_ref { full_board.push(c); }
                    for i in 0..board_fill_n { full_board.push(board_sample[i]); }
                    full_board.sort();
                    let board_bm = card_bitmap(&full_board);
                    let board_3s = three_card_subsets_from_slice(&full_board);
                    let hero_rank = eval_best(hero_2s_ref, &board_3s, table_ref);

                    let villain_arr: [u8; 5];
                    if use_range {
                        let pool_len = rank_pool_ref.len();
                        let mut found = false;
                        let mut attempt_villain = [0u8; 5];
                        for _ in 0..200 {
                            let vi = rng.gen_range(pool_len);
                            let cand = rank_pool_ref[vi];
                            let cand_bm = card_bitmap(&cand);
                            if cand_bm & hero_bm != 0 { continue; }
                            if cand_bm & board_bm != 0 { continue; }
                            attempt_villain = cand;
                            found = true;
                            break;
                        }
                        if !found { continue; }
                        villain_arr = attempt_villain;
                    } else {
                        let pool: Vec<u8> = remaining_ref.iter()
                            .filter(|&&c| board_bm & (1u64 << (c as u64)) == 0)
                            .copied().collect();
                        villain_arr = sample_villain(&pool, &mut rng);
                    }

                    let villain_2s = two_card_subsets(&villain_arr);
                    let villain_rank = eval_best(&villain_2s, &board_3s, table_ref);

                    if hero_rank < villain_rank { wins += 1.0; }
                    else if hero_rank == villain_rank { wins += 0.5; }
                    total += 1;
                }
                (wins, total)
            })
        }).collect();
        let (tw, tc): (f64, u64) = handles.into_iter()
            .map(|h| h.join().unwrap())
            .fold((0.0, 0), |(w, c), (w2, c2)| (w + w2, c + c2));
        (tw / tc as f64, tw, tc)
    });

    let elapsed = t0.elapsed().as_secs_f64();
    let elapsed_ms = (elapsed * 1000.0) as u64;
    let wins_int = total_wins_f as u64;
    let ties_approx = ((total_wins_f - wins_int as f64) * 2.0) as u64;
    let losses = total_count_u - wins_int - ties_approx;

    if json_output {
        println!(
            "{{\"ok\":true,\"equity\":{:.6},\"equityPct\":{:.4},\"wins\":{},\"ties\":{},\"losses\":{},\"trials\":{},\"seed\":{},\"elapsedMs\":{},\"villainRange\":\"{}\"}}",
            mc_equity, mc_equity * 100.0, wins_int, ties_approx, losses, total_count_u, seed, elapsed_ms, villain_range_str
        );
    } else {
        eprintln!();
        eprintln!("╔══════════════════════════════════════════════╗");
        eprintln!("║              Result                          ║");
        eprintln!("╚══════════════════════════════════════════════╝");
        eprintln!("  Hand:    {}", card_names.join(""));
        eprintln!("  Villain: {}", villain_range_str);
        eprintln!("  Equity:  {:.3}%", mc_equity * 100.0);
        eprintln!("  Trials:  {}", total_count_u);
        eprintln!("  Seed:    {}", seed);
        eprintln!("  Time:    {:.1}s", elapsed);
    }
}

fn run_precompute_all(args: &[String]) {
    let boards_n: u32 = parse_flag(args, "--boards")
        .and_then(|s| s.parse().ok()).unwrap_or(1000);
    let villain_samples: u32 = parse_flag(args, "--villain-samples")
        .and_then(|s| s.parse().ok()).unwrap_or(10);
    let seed: u64 = parse_flag(args, "--seed")
        .and_then(|s| s.parse().ok()).unwrap_or(12345);
    let threads_str = parse_flag(args, "--threads").unwrap_or_else(|| "auto".into());
    let out_equity = parse_flag(args, "--out-equity")
        .unwrap_or_else(|| "equity_all_2598960.f32".into());
    let out_rank = parse_flag(args, "--out-rank")
        .unwrap_or_else(|| "rank_index_all_2598960.u32".into());

    let total_hands: u32 = BINOM[52][5];
    assert_eq!(total_hands, 2598960);

    let num_threads: usize = match threads_str.as_str() {
        "auto" => num_cpus(),
        s => s.parse().unwrap_or(4),
    };

    eprintln!("╔══════════════════════════════════════════════╗");
    eprintln!("║  PLO5 Precompute ALL 2,598,960 hands         ║");
    eprintln!("╚══════════════════════════════════════════════╝");
    eprintln!();
    eprintln!("  Total hands:        {}", total_hands);
    eprintln!("  Boards/hero:        {}", boards_n);
    eprintln!("  Villain samples:    {}", villain_samples);
    eprintln!("  Seed:               {}", seed);
    eprintln!("  Threads:            {}", num_threads);
    eprintln!("  Output equity:      {}", out_equity);
    eprintln!("  Output rank:        {}", out_rank);
    eprintln!();

    let t0 = Instant::now();
    eprintln!("[1/4] Initializing eval table...");
    let table = init_eval_table();
    eprintln!("       Done in {:.2}s", t0.elapsed().as_secs_f64());

    eprintln!("[2/4] Verifying index_to_hand bijection (spot check)...");
    for test_i in [0u32, 1, 100, 1000, 2598959] {
        let h = index_to_hand(test_i);
        let back = comb_index(&h) as u32;
        assert_eq!(test_i, back, "index_to_hand roundtrip failed for {}", test_i);
    }
    eprintln!("       Bijection OK");

    let evals_per_hero = boards_n as u64 * villain_samples as u64;
    let total_evals = evals_per_hero * total_hands as u64;
    eprintln!();
    eprintln!("[3/4] Computing equity for all {} hands...", total_hands);
    eprintln!("       {} showdowns/hero × {} heroes = {:.2}B total",
        evals_per_hero, total_hands, total_evals as f64 / 1e9);

    let equities = vec![0.0f64; total_hands as usize];
    let equity_ptr = equities.as_ptr() as usize;

    let progress = AtomicU64::new(0);
    let t2 = Instant::now();
    let chunk_size = (total_hands as usize + num_threads - 1) / num_threads;

    thread::scope(|s| {
        for t in 0..num_threads {
            let table_ref = &table;
            let progress_ref = &progress;
            let eq_ptr = equity_ptr;
            s.spawn(move || {
                let start = t * chunk_size;
                let end = ((t + 1) * chunk_size).min(total_hands as usize);
                let eq_slice = unsafe {
                    std::slice::from_raw_parts_mut(eq_ptr as *mut f64, total_hands as usize)
                };
                let mut rng = Xorshift64::new(mix_seed(seed.wrapping_add(t as u64)));

                for idx in start..end {
                    let hero = index_to_hand(idx as u32);
                    let hero_bm = card_bitmap(&hero);
                    let hero_2s = two_card_subsets(&hero);

                    let remaining: Vec<u8> = (0..52u8)
                        .filter(|c| hero_bm & (1u64 << (*c as u64)) == 0)
                        .collect();

                    let mut wins = 0.0f64;
                    let mut total = 0u64;

                    for _ in 0..boards_n {
                        let sampled = sample_n(&remaining, 10, &mut rng);
                        let mut board = [sampled[0], sampled[1], sampled[2], sampled[3], sampled[4]];
                        board.sort();
                        let board_bm = card_bitmap(&board);
                        let board_3s = three_card_subsets(&board);
                        let hero_rank = eval_best(&hero_2s, &board_3s, table_ref);

                        let pool: Vec<u8> = remaining.iter()
                            .filter(|&&c| board_bm & (1u64 << (c as u64)) == 0)
                            .copied()
                            .collect();

                        for v in 0..villain_samples {
                            let _ = v;
                            let villain = sample_villain(&pool, &mut rng);
                            let villain_2s = two_card_subsets(&villain);
                            let villain_rank = eval_best(&villain_2s, &board_3s, table_ref);
                            if hero_rank < villain_rank { wins += 1.0; }
                            else if hero_rank == villain_rank { wins += 0.5; }
                            total += 1;
                        }
                    }

                    eq_slice[idx] = if total > 0 { wins / total as f64 } else { 0.5 };

                    let done = progress_ref.fetch_add(1, Ordering::Relaxed) + 1;
                    if done % 50000 == 0 || done == total_hands as u64 {
                        let elapsed = t2.elapsed().as_secs_f64();
                        let rate = done as f64 / elapsed;
                        let eta = (total_hands as u64 - done) as f64 / rate;
                        eprint!("\r       {}/{} ({:.1}%) — {:.0} hands/s — ETA {:.0}s   ",
                            done, total_hands, done as f64 / total_hands as f64 * 100.0, rate, eta);
                    }
                }
            });
        }
    });
    eprintln!();
    let compute_time = t2.elapsed().as_secs_f64();
    eprintln!("       Done in {:.1}s ({:.0} hands/s)", compute_time, total_hands as f64 / compute_time);

    eprintln!();
    eprintln!("[4/4] Writing output files...");

    {
        let f = File::create(&out_equity).expect("Cannot create equity output file");
        let mut w = BufWriter::new(f);
        for &eq in &equities {
            w.write_all(&(eq as f32).to_le_bytes()).unwrap();
        }
        w.flush().unwrap();
        let size = total_hands as u64 * 4;
        eprintln!("       {} — {} bytes ({:.2} MB)", out_equity, size, size as f64 / 1e6);
    }

    {
        let mut indices: Vec<u32> = (0..total_hands).collect();
        indices.sort_by(|&a, &b| {
            equities[b as usize]
                .partial_cmp(&equities[a as usize])
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let f = File::create(&out_rank).expect("Cannot create rank output file");
        let mut w = BufWriter::new(f);
        for &idx in &indices {
            w.write_all(&idx.to_le_bytes()).unwrap();
        }
        w.flush().unwrap();
        let size = total_hands as u64 * 4;
        eprintln!("       {} — {} bytes ({:.2} MB)", out_rank, size, size as f64 / 1e6);
    }

    let total_time = t0.elapsed().as_secs_f64();
    eprintln!();
    eprintln!("  Total time: {:.1}s ({:.1} min)", total_time, total_time / 60.0);
    eprintln!("  Done!");
}

fn run_breakdown(args: &[String]) {
    let hand_str = parse_flag(args, "--hand").unwrap_or_else(|| {
        eprintln!("Usage: plo5_ranker breakdown --hand <hand> --board <3or4cards> [--dead <cards>] [--trials-budget N] [--seed S] [--villain-range 100%|N%] [--rank-file path] [--json]");
        std::process::exit(1);
    });
    let trials_budget: u64 = parse_flag(args, "--trials-budget")
        .and_then(|s| s.parse().ok()).unwrap_or(600_000);
    let seed: u64 = parse_flag(args, "--seed")
        .and_then(|s| s.parse().ok()).unwrap_or(12345);
    let json_output = args.iter().any(|a| a == "--json");
    let board_str = parse_flag(args, "--board").unwrap_or_default();
    let dead_str = parse_flag(args, "--dead").unwrap_or_default();
    let villain_range_str = parse_flag(args, "--villain-range").unwrap_or_else(|| "100%".into());
    let rank_file = parse_flag(args, "--rank-file").unwrap_or_else(|| "public/rank_index_all_2598960.u32".into());

    let villain_pct = parse_villain_range(&villain_range_str).unwrap_or_else(|| {
        if json_output {
            println!("{{\"ok\":false,\"error\":\"Invalid villain range: '{}'. Use N% (e.g. 10%, 20%, 100%)\"}}", villain_range_str);
            std::process::exit(0);
        }
        eprintln!("Invalid villain range: '{}'. Use N% (e.g. 10%, 20%, 100%)", villain_range_str);
        std::process::exit(1);
    });
    let is_range_restricted = villain_pct < 100.0;

    let hand = parse_hand(&hand_str).unwrap_or_else(|| {
        if json_output {
            println!("{{\"ok\":false,\"error\":\"Could not parse hand: {} (need exactly 5 cards)\"}}", hand_str);
            std::process::exit(0);
        }
        eprintln!("Could not parse hand: {}", hand_str);
        std::process::exit(1);
    });

    let board_cards = parse_cards_vec(&board_str);
    let dead_cards = parse_cards_vec(&dead_str);

    if board_cards.len() != 3 && board_cards.len() != 4 {
        if json_output {
            println!("{{\"ok\":false,\"error\":\"Breakdown requires board of 3 (flop) or 4 (turn) cards, got {}\"}}", board_cards.len());
            std::process::exit(0);
        }
        eprintln!("Breakdown requires board of 3 (flop) or 4 (turn) cards, got {}", board_cards.len());
        std::process::exit(1);
    }

    let mut excluded: Vec<u8> = Vec::new();
    for &c in hand.iter() { excluded.push(c); }
    for &c in &board_cards { excluded.push(c); }
    for &c in &dead_cards { excluded.push(c); }
    excluded.sort();
    excluded.dedup();
    if excluded.len() != hand.len() + board_cards.len() + dead_cards.len() {
        if json_output {
            println!("{{\"ok\":false,\"error\":\"Duplicate cards found among hand, board, and dead cards\"}}");
            std::process::exit(0);
        }
        eprintln!("Duplicate cards found");
        std::process::exit(1);
    }

    let excluded_bm = card_bitmap(&excluded);
    let candidate_cards: Vec<u8> = (0..52u8)
        .filter(|c| excluded_bm & (1u64 << (*c as u64)) == 0)
        .collect();
    let num_candidates = candidate_cards.len();
    let is_turn_breakdown = board_cards.len() == 3;

    let trials_per_card = (trials_budget / num_candidates as u64).max(100);

    let rank_pool: Vec<[u8; 5]> = if is_range_restricted {
        let rank_index = load_rank_index(&rank_file);
        let top_count = ((villain_pct / 100.0) * 2598960.0).ceil() as usize;
        let top_count = top_count.min(2598960);
        rank_index[..top_count].iter().map(|&idx| index_to_hand(idx)).collect()
    } else {
        Vec::new()
    };

    let t0 = Instant::now();
    if !json_output { eprintln!("[1/2] Initializing eval table..."); }
    let table = init_eval_table();
    if !json_output {
        eprintln!("       Done in {:.2}s", t0.elapsed().as_secs_f64());
        eprintln!("[2/2] Computing breakdown for {} candidate cards ({} trials each)...",
            num_candidates, trials_per_card);
        eprintln!("       Board: {} cards, next street: {}",
            board_cards.len(), if is_turn_breakdown { "turn" } else { "river" });
    }

    let hero_2s = two_card_subsets(&hand);
    let hero_bm = card_bitmap(&hand);
    let board_bm = card_bitmap(&board_cards);
    let num_threads = num_cpus();

    let mut crn_scenarios: Vec<(Vec<u8>, Vec<u64>)> = Vec::new();
    if is_turn_breakdown {
        let mut scenario_rng = Xorshift64::new(mix_seed(seed.wrapping_add(999)));
        for _ in 0..trials_per_card {
            let river_card_idx = scenario_rng.gen_range(52);
            let river_card = river_card_idx as u8;
            let villain_seed = scenario_rng.next();
            crn_scenarios.push((vec![river_card], vec![villain_seed]));
        }
    } else {
        let mut scenario_rng = Xorshift64::new(mix_seed(seed.wrapping_add(999)));
        for _ in 0..trials_per_card {
            let villain_seed = scenario_rng.next();
            crn_scenarios.push((vec![], vec![villain_seed]));
        }
    }

    let chunk_size = (num_candidates + num_threads - 1) / num_threads;

    let results: Vec<Vec<(u8, f64, u64)>> = thread::scope(|s| {
        let handles: Vec<_> = (0..num_threads).map(|t| {
            let table_ref = &table;
            let hero_2s_ref = &hero_2s;
            let board_cards_ref = &board_cards;
            let candidate_cards_ref = &candidate_cards;
            let rank_pool_ref = &rank_pool;
            let use_range = is_range_restricted;
            let scenarios_ref = &crn_scenarios;
            s.spawn(move || {
                let start = t * chunk_size;
                let end = ((t + 1) * chunk_size).min(num_candidates);
                let mut thread_results: Vec<(u8, f64, u64)> = Vec::new();

                for ci in start..end {
                    let next_card = candidate_cards_ref[ci];
                    let next_bm = 1u64 << (next_card as u64);
                    let mut full_board_base: Vec<u8> = board_cards_ref.to_vec();
                    full_board_base.push(next_card);

                    let combined_bm_base = hero_bm | board_bm | next_bm;

                    let mut wins = 0.0f64;
                    let mut count = 0u64;

                    if is_turn_breakdown {
                        for sc in scenarios_ref.iter() {
                            let river_card = sc.0[0];
                            let river_bm = 1u64 << (river_card as u64);
                            if river_bm & combined_bm_base != 0 { continue; }
                            let combined_bm = combined_bm_base | river_bm;

                            let mut full_board = full_board_base.clone();
                            full_board.push(river_card);
                            full_board.sort();
                            let board_3s = three_card_subsets_from_slice(&full_board);
                            let hero_rank = eval_best(hero_2s_ref, &board_3s, table_ref);

                            let vseed = sc.1[0];
                            if use_range {
                                let pool_len = rank_pool_ref.len();
                                let mut vrng = Xorshift64::new(mix_seed(vseed));
                                let mut found = false;
                                let mut villain_arr = [0u8; 5];
                                for _ in 0..200 {
                                    let vi = vrng.gen_range(pool_len);
                                    let cand = rank_pool_ref[vi];
                                    let cand_bm = card_bitmap(&cand);
                                    if cand_bm & combined_bm != 0 { continue; }
                                    villain_arr = cand;
                                    found = true;
                                    break;
                                }
                                if !found { continue; }
                                let villain_2s = two_card_subsets(&villain_arr);
                                let villain_rank = eval_best(&villain_2s, &board_3s, table_ref);
                                if hero_rank < villain_rank { wins += 1.0; }
                                else if hero_rank == villain_rank { wins += 0.5; }
                                count += 1;
                            } else {
                                let pool: Vec<u8> = (0..52u8)
                                    .filter(|c| combined_bm & (1u64 << (*c as u64)) == 0)
                                    .collect();
                                let mut vrng = Xorshift64::new(mix_seed(vseed));
                                let villain = sample_villain(&pool, &mut vrng);
                                let villain_2s = two_card_subsets(&villain);
                                let villain_rank = eval_best(&villain_2s, &board_3s, table_ref);
                                if hero_rank < villain_rank { wins += 1.0; }
                                else if hero_rank == villain_rank { wins += 0.5; }
                                count += 1;
                            }
                        }
                    } else {
                        full_board_base.sort();
                        let board_3s = three_card_subsets_from_slice(&full_board_base);
                        let hero_rank = eval_best(hero_2s_ref, &board_3s, table_ref);

                        for sc in scenarios_ref.iter() {
                            let vseed = sc.1[0];
                            if use_range {
                                let pool_len = rank_pool_ref.len();
                                let mut vrng = Xorshift64::new(mix_seed(vseed));
                                let mut found = false;
                                let mut villain_arr = [0u8; 5];
                                for _ in 0..200 {
                                    let vi = vrng.gen_range(pool_len);
                                    let cand = rank_pool_ref[vi];
                                    let cand_bm = card_bitmap(&cand);
                                    if cand_bm & combined_bm_base != 0 { continue; }
                                    villain_arr = cand;
                                    found = true;
                                    break;
                                }
                                if !found { continue; }
                                let villain_2s = two_card_subsets(&villain_arr);
                                let villain_rank = eval_best(&villain_2s, &board_3s, table_ref);
                                if hero_rank < villain_rank { wins += 1.0; }
                                else if hero_rank == villain_rank { wins += 0.5; }
                                count += 1;
                            } else {
                                let pool: Vec<u8> = (0..52u8)
                                    .filter(|c| combined_bm_base & (1u64 << (*c as u64)) == 0)
                                    .collect();
                                let mut vrng = Xorshift64::new(mix_seed(vseed));
                                let villain = sample_villain(&pool, &mut vrng);
                                let villain_2s = two_card_subsets(&villain);
                                let villain_rank = eval_best(&villain_2s, &board_3s, table_ref);
                                if hero_rank < villain_rank { wins += 1.0; }
                                else if hero_rank == villain_rank { wins += 0.5; }
                                count += 1;
                            }
                        }
                    }

                    let eq = if count > 0 { wins / count as f64 } else { 0.5 };
                    thread_results.push((next_card, eq, count));
                }
                thread_results
            })
        }).collect();
        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });

    let mut all_results: Vec<(u8, f64, u64)> = results.into_iter().flatten().collect();
    all_results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let elapsed = t0.elapsed().as_secs_f64();
    let elapsed_ms = (elapsed * 1000.0) as u64;
    let total_trials: u64 = all_results.iter().map(|r| r.2).sum();

    let excluded_names: Vec<String> = excluded.iter().map(|&c| card_name(c)).collect();

    if json_output {
        print!("{{\"ok\":true,\"street\":\"{}\",\"items\":[",
            if is_turn_breakdown { "turn" } else { "river" });
        for (i, &(card, eq, trials)) in all_results.iter().enumerate() {
            if i > 0 { print!(","); }
            print!("{{\"card\":\"{}\",\"equity\":{:.6},\"trials\":{}}}",
                card_name(card), eq, trials);
        }
        print!("],\"excluded\":[");
        for (i, name) in excluded_names.iter().enumerate() {
            if i > 0 { print!(","); }
            print!("\"{}\"", name);
        }
        println!("],\"totalTrials\":{},\"trialsPerCard\":{},\"numCandidates\":{},\"seed\":{},\"elapsedMs\":{},\"villainRange\":\"{}\"}}",
            total_trials, trials_per_card, num_candidates, seed, elapsed_ms, villain_range_str);
    } else {
        eprintln!();
        eprintln!("EQ Breakdown by next card ({}→{}):",
            if is_turn_breakdown { "Flop" } else { "Turn" },
            if is_turn_breakdown { "Turn" } else { "River" });
        eprintln!("  {:>4}  {:<6}  {:>10}  {:>8}", "#", "Card", "Equity%", "Trials");
        eprintln!("  ────  ──────  ──────────  ────────");
        for (i, &(card, eq, trials)) in all_results.iter().enumerate() {
            eprintln!("  {:>4}  {:<6}  {:>9.3}%  {:>8}", i + 1, card_name(card), eq * 100.0, trials);
        }
        eprintln!();
        eprintln!("  Total trials: {}, Time: {:.1}s, Seed: {}", total_trials, elapsed, seed);
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("PLO5 Ranker Engine v2.0");
        eprintln!();
        eprintln!("Usage:");
        eprintln!("  plo5_ranker precompute [options]       Canonical hand rankings (134K hands)");
        eprintln!("  plo5_ranker precompute_all [options]   ALL 2,598,960 hands equity");
        eprintln!("    --boards <N>            Random boards per hero (default: 1000)");
        eprintln!("    --villain-samples <N>   Villain hands per board (default: 10)");
        eprintln!("    --seed <u64>            RNG seed (default: 12345)");
        eprintln!("    --threads auto|<N>      Thread count (default: auto)");
        eprintln!("    --out-equity <path>     Output equity file (default: equity_all_2598960.f32)");
        eprintln!("    --out-rank <path>       Output rank index file (default: rank_index_all_2598960.u32)");
        eprintln!();
        eprintln!("  plo5_ranker equity [options]");
        eprintln!("    --hand <hand>           Hand to evaluate (e.g., AcAdKhQh5s)");
        eprintln!("    --trials <N>            MC trials (default: 600000)");
        eprintln!("    --seed <u64>            RNG seed (default: 12345)");
        eprintln!();
        eprintln!("  plo5_ranker accuracy [options]");
        eprintln!("    --bin <path>            Binary file to test (default: plo5_rankings_prod.bin)");
        eprintln!("    --trials <N>            MC trials per hand (default: 2000000)");
        eprintln!("    --test-hands <list>     Comma-separated hands to test");
        eprintln!();
        eprintln!("  plo5_ranker baseline [options]");
        eprintln!("    --out <path>            Output file (default: baseline.json)");
        eprintln!("    --hands <N>             Number of hands to baseline (default: 300)");
        eprintln!("    --trials <N>            MC trials per hand (default: 5000000)");
        eprintln!();
        eprintln!("  plo5_ranker validate [options]");
        eprintln!("    --bin <path>            Binary rankings file");
        eprintln!("    --baseline <path>       Baseline JSON file");
        eprintln!();
        eprintln!("  plo5_ranker info");
        eprintln!();
        std::process::exit(0);
    }

    match args[1].as_str() {
        "precompute" => run_precompute(&args[2..]),
        "precompute_all" => run_precompute_all(&args[2..]),
        "equity" => run_equity(&args[2..]),
        "breakdown" => run_breakdown(&args[2..]),
        "accuracy" => run_accuracy(&args[2..]),
        "baseline" => run_baseline(&args[2..]),
        "validate" => run_validate(&args[2..]),
        "info" => run_info(),
        other => {
            eprintln!("Unknown command: {}. Use precompute, precompute_all, equity, breakdown, accuracy, baseline, validate, or info.", other);
            std::process::exit(1);
        }
    }
}
