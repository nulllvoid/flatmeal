import { dbQuery } from './db';
import { TEST_FLAT_ID } from './test-users';
import { todayIst } from './poll-state';

// Seeds a real 'open' poll for today with the given main-dish slugs as
// options — a lighter-weight alternative to invoking create_poll's full
// selection heuristic when a test only cares about voting/tally behavior
// on a known, fixed set of options. Tests that specifically exercise
// create_poll's own selection logic (dietary veto, variety, exclusion) call
// triggerCreatePoll from poll-state.ts instead and inspect what it actually
// picked.
export function seedOpenPoll(dishSlugs: string[], flatId: string = TEST_FLAT_ID, date: string = todayIst()) {
  dbQuery(`
    insert into daily_polls (flat_id, poll_date, status)
    values ('${flatId}', '${date}', 'open')
    on conflict (flat_id, poll_date) do update set
      status = 'open', winner_recipe_id = null, winner_reason = null,
      winner_accompaniment_recipe_id = null, winner_accompaniment_reason = null;

    insert into poll_options (poll_id, recipe_id, position)
    select dp.id, r.id, v.position
    from (values ${dishSlugs.map((slug, i) => `('${slug}', ${i + 1})`).join(', ')}) as v(slug, position)
    join daily_polls dp on dp.flat_id = '${flatId}' and dp.poll_date = '${date}'
    join recipes r on r.slug = v.slug
    on conflict (poll_id, recipe_id) do nothing;
  `);
}

export function castVoteAsUser(userId: string, dishSlug: string, flatId: string = TEST_FLAT_ID, date: string = todayIst()) {
  dbQuery(`
    insert into votes (poll_id, user_id, recipe_id)
    select dp.id, '${userId}', r.id
    from daily_polls dp, recipes r
    where dp.flat_id = '${flatId}' and dp.poll_date = '${date}' and r.slug = '${dishSlug}'
    on conflict (poll_id, user_id) do update set recipe_id = excluded.recipe_id;
  `);
}

export function castAccompanimentVoteAsUser(
  userId: string,
  accompanimentSlug: string,
  flatId: string = TEST_FLAT_ID,
  date: string = todayIst()
) {
  dbQuery(`
    insert into accompaniment_votes (poll_id, user_id, recipe_id)
    select dp.id, '${userId}', r.id
    from daily_polls dp, recipes r
    where dp.flat_id = '${flatId}' and dp.poll_date = '${date}' and r.slug = '${accompanimentSlug}'
    on conflict (poll_id, user_id) do update set recipe_id = excluded.recipe_id;
  `);
}
