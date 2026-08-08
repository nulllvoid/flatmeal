## Table `profiles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `display_name` | `text` |  |
| `diet_type` | `text` |  |
| `is_jain` | `bool` |  |
| `allergies` | `_text` |  |
| `push_token` | `text` |  Nullable |
| `notifications_muted` | `bool` |  |
| `created_at` | `timestamptz` |  |

## Table `flats`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` |  |
| `invite_code` | `text` |  Unique |
| `poll_open_time` | `time` |  |
| `poll_close_time` | `time` |  |
| `dispatch_time` | `time` |  |
| `tz` | `text` |  |
| `created_by` | `uuid` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `flat_members`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `flat_id` | `uuid` | Primary |
| `user_id` | `uuid` | Primary |
| `role` | `text` |  |
| `joined_at` | `timestamptz` |  |

## Table `cooks`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `flat_id` | `uuid` |  |
| `name` | `text` |  |
| `phone` | `text` |  |
| `language` | `text` |  |
| `is_active` | `bool` |  |
| `audit_note` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `recipes`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `slug` | `text` |  Unique |
| `name` | `text` |  |
| `cuisine` | `text` |  |
| `base` | `text` |  |
| `diet_class` | `text` |  |
| `jain_ok` | `bool` |  |
| `allergens` | `_text` |  |
| `seasons` | `_text` |  |
| `instructions_en` | `text` |  |
| `image_path` | `text` |  Nullable |
| `is_active` | `bool` |  |
| `created_at` | `timestamptz` |  |
| `kind` | `text` |  |

## Table `recipe_ingredients`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `recipe_id` | `uuid` |  |
| `name_en` | `text` |  |
| `name_hi` | `text` |  Nullable |
| `name_kn` | `text` |  Nullable |
| `qty_per_person` | `numeric` |  |
| `unit` | `text` |  |
| `category` | `text` |  |
| `is_staple` | `bool` |  |
| `sort_order` | `int4` |  |

## Table `recipe_translations`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `recipe_id` | `uuid` | Primary |
| `language` | `text` | Primary |
| `instructions` | `text` |  |
| `reviewed_by` | `text` |  Nullable |
| `reviewed_at` | `timestamptz` |  Nullable |

## Table `daily_polls`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `flat_id` | `uuid` |  |
| `poll_date` | `date` |  |
| `status` | `text` |  |
| `winner_recipe_id` | `uuid` |  Nullable |
| `winner_reason` | `text` |  Nullable |
| `flat_note` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `winner_accompaniment_recipe_id` | `uuid` |  Nullable |
| `winner_accompaniment_reason` | `text` |  Nullable |

## Table `poll_options`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `poll_id` | `uuid` | Primary |
| `recipe_id` | `uuid` | Primary |
| `position` | `int4` |  |

## Table `votes`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `poll_id` | `uuid` | Primary |
| `user_id` | `uuid` | Primary |
| `recipe_id` | `uuid` |  |
| `voted_at` | `timestamptz` |  |

## Table `day_attendance`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `flat_id` | `uuid` | Primary |
| `user_id` | `uuid` | Primary |
| `poll_date` | `date` | Primary |
| `is_out` | `bool` |  |
| `updated_at` | `timestamptz` |  |

## Table `grocery_checks`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `poll_id` | `uuid` | Primary |
| `ingredient_id` | `uuid` | Primary |
| `checked_by` | `uuid` |  Nullable |
| `checked_at` | `timestamptz` |  |

## Table `dispatch_log`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `poll_id` | `uuid` |  |
| `mode` | `text` |  |
| `language` | `text` |  |
| `headcount` | `int4` |  |
| `payload_en` | `text` |  |
| `payload_translated` | `text` |  |
| `bsp_message_id` | `text` |  Nullable |
| `status` | `text` |  |
| `error` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `meal_feedback`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `poll_id` | `uuid` | Primary |
| `user_id` | `uuid` | Primary |
| `thumbs_up` | `bool` |  |
| `created_at` | `timestamptz` |  |

## Table `feedback`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  Nullable |
| `flat_id` | `uuid` |  Nullable |
| `body` | `text` |  |
| `created_at` | `timestamptz` |  |

## Table `pipeline_errors`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `stage` | `text` |  |
| `flat_id` | `uuid` |  Nullable |
| `detail` | `jsonb` |  |
| `created_at` | `timestamptz` |  |

## Table `recipe_accompaniments`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `main_recipe_id` | `uuid` | Primary |
| `accompaniment_recipe_id` | `uuid` | Primary |
| `sort_order` | `int4` |  |

## Table `poll_accompaniment_options`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `poll_id` | `uuid` | Primary |
| `recipe_id` | `uuid` | Primary |
| `position` | `int4` |  |

## Table `accompaniment_votes`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `poll_id` | `uuid` | Primary |
| `user_id` | `uuid` | Primary |
| `recipe_id` | `uuid` |  |
| `voted_at` | `timestamptz` |  |

## RLS Policies

### `recipe_ingredients`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `recipe_ingredients: authenticated read` | SELECT | authenticated | PERMISSIVE | `true` | — |

### `recipe_translations`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `recipe_translations: authenticated read` | SELECT | authenticated | PERMISSIVE | `true` | — |

### `recipes`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `recipes: authenticated read` | SELECT | authenticated | PERMISSIVE | `true` | — |

### `poll_options`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `poll_options: members read` | SELECT | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM daily_polls p   WHERE ((p.id = poll_options.poll_id) AND is_flat_member(p.flat_id))))` | — |

### `votes`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `votes: members cast own vote` | INSERT | public | PERMISSIVE | — | `((user_id = auth.uid()) AND (EXISTS ( SELECT 1    FROM daily_polls p   WHERE ((p.id = votes.poll_id) AND is_flat_member(p.flat_id)))))` |
| `votes: members change own vote` | UPDATE | public | PERMISSIVE | `(user_id = auth.uid())` | — |
| `votes: members read` | SELECT | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM daily_polls p   WHERE ((p.id = votes.poll_id) AND is_flat_member(p.flat_id))))` | — |
| `votes: members remove own vote` | DELETE | public | PERMISSIVE | `(user_id = auth.uid())` | — |

### `day_attendance`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `day_attendance: members read` | SELECT | public | PERMISSIVE | `is_flat_member(flat_id)` | — |
| `day_attendance: members set own` | INSERT | public | PERMISSIVE | — | `((user_id = auth.uid()) AND is_flat_member(flat_id))` |
| `day_attendance: members update own` | UPDATE | public | PERMISSIVE | `(user_id = auth.uid())` | — |

### `grocery_checks`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `grocery_checks: members read` | SELECT | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM daily_polls p   WHERE ((p.id = grocery_checks.poll_id) AND is_flat_member(p.flat_id))))` | — |
| `grocery_checks: members toggle` | ALL | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM daily_polls p   WHERE ((p.id = grocery_checks.poll_id) AND is_flat_member(p.flat_id))))` | `(EXISTS ( SELECT 1    FROM daily_polls p   WHERE ((p.id = grocery_checks.poll_id) AND is_flat_member(p.flat_id))))` |

### `dispatch_log`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `dispatch_log: members read` | SELECT | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM daily_polls p   WHERE ((p.id = dispatch_log.poll_id) AND is_flat_member(p.flat_id))))` | — |

### `meal_feedback`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `meal_feedback: members read` | SELECT | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM daily_polls p   WHERE ((p.id = meal_feedback.poll_id) AND is_flat_member(p.flat_id))))` | — |
| `meal_feedback: members submit own` | INSERT | public | PERMISSIVE | — | `((user_id = auth.uid()) AND (EXISTS ( SELECT 1    FROM daily_polls p   WHERE ((p.id = meal_feedback.poll_id) AND is_flat_member(p.flat_id)))))` |

### `daily_polls`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `daily_polls: members read` | SELECT | public | PERMISSIVE | `is_flat_member(flat_id)` | — |
| `daily_polls: members update flat_note` | UPDATE | public | PERMISSIVE | `is_flat_member(flat_id)` | — |

### `profiles`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `profiles: insert own row` | INSERT | public | PERMISSIVE | — | `(id = auth.uid())` |
| `profiles: read flatmates` | SELECT | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM (flat_members mine      JOIN flat_members theirs ON ((theirs.flat_id = mine.flat_id)))   WHERE ((mine.user_id = auth.uid()) AND (theirs.user_id = profiles.id))))` | — |
| `profiles: read own row` | SELECT | public | PERMISSIVE | `(id = auth.uid())` | — |
| `profiles: update own row` | UPDATE | public | PERMISSIVE | `(id = auth.uid())` | — |

### `flats`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `flats: authenticated create` | INSERT | public | PERMISSIVE | — | `(created_by = auth.uid())` |
| `flats: members read` | SELECT | public | PERMISSIVE | `(is_flat_member(id) OR (created_by = auth.uid()))` | — |
| `flats: members update` | UPDATE | public | PERMISSIVE | `is_flat_member(id)` | — |

### `flat_members`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `flat_members: members read` | SELECT | public | PERMISSIVE | `is_flat_member(flat_id)` | — |
| `flat_members: self join` | INSERT | public | PERMISSIVE | — | `(user_id = auth.uid())` |
| `flat_members: self leave` | DELETE | public | PERMISSIVE | `(user_id = auth.uid())` | — |

### `cooks`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `cooks: members read` | SELECT | public | PERMISSIVE | `is_flat_member(flat_id)` | — |
| `cooks: members write` | ALL | public | PERMISSIVE | `is_flat_member(flat_id)` | `is_flat_member(flat_id)` |

### `feedback`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `feedback: members read own` | SELECT | public | PERMISSIVE | `(user_id = auth.uid())` | — |
| `feedback: members submit own` | INSERT | public | PERMISSIVE | — | `(user_id = auth.uid())` |

### `recipe_accompaniments`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `recipe_accompaniments: authenticated read` | SELECT | authenticated | PERMISSIVE | `true` | — |

### `poll_accompaniment_options`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `poll_accompaniment_options: members read` | SELECT | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM daily_polls p   WHERE ((p.id = poll_accompaniment_options.poll_id) AND is_flat_member(p.flat_id))))` | — |

### `accompaniment_votes`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `accompaniment_votes: members cast own vote` | INSERT | public | PERMISSIVE | — | `((user_id = auth.uid()) AND (EXISTS ( SELECT 1    FROM daily_polls p   WHERE ((p.id = accompaniment_votes.poll_id) AND is_flat_member(p.flat_id)))))` |
| `accompaniment_votes: members change own vote` | UPDATE | public | PERMISSIVE | `(user_id = auth.uid())` | — |
| `accompaniment_votes: members read` | SELECT | public | PERMISSIVE | `(EXISTS ( SELECT 1    FROM daily_polls p   WHERE ((p.id = accompaniment_votes.poll_id) AND is_flat_member(p.flat_id))))` | — |
| `accompaniment_votes: members remove own vote` | DELETE | public | PERMISSIVE | `(user_id = auth.uid())` | — |

