<?php

declare(strict_types=1);

require_once __DIR__ . '/app/bootstrap.php';

$status = erdet_get_war_status();
$militaryExerciseNotices = erdet_get_military_exercise_notices();
$showStatusExplanation = in_array($status['status'], ['yes', 'assume-no'], true);
$showExercisePopup = $status['status'] !== 'yes' && count($militaryExerciseNotices) > 0;
$faqItems = erdet_faq_items($status);
$faqJsonLd = erdet_faq_json_ld($faqItems);
$config = erdet_config();
$siteUrl = rtrim((string) $config['site_url'], '/');
$title = 'Er det krig i Norge nå?';
$description = 'En enkel norsk statusside som svarer ja eller nei på om det er krig i Norge nå, basert på aktive Nødvarsler.';
?>
<!doctype html>
<html lang="nb">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f6f3eb">
  <title><?= erdet_html($title) ?></title>
  <meta name="description" content="<?= erdet_html($description) ?>">
  <link rel="canonical" href="<?= erdet_html($siteUrl) ?>/">
  <meta property="og:title" content="<?= erdet_html($title) ?>">
  <meta property="og:description" content="<?= erdet_html($description) ?>">
  <meta property="og:url" content="<?= erdet_html($siteUrl) ?>/">
  <meta property="og:site_name" content="erdetkriginorge.no">
  <meta property="og:locale" content="nb_NO">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="<?= erdet_html($title) ?>">
  <meta name="twitter:description" content="<?= erdet_html($description) ?>">
  <link rel="stylesheet" href="/assets/styles.css">
  <script type="application/ld+json"><?= json_encode($faqJsonLd, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?></script>
</head>
<body>
  <main>
    <section class="statusHero statusHero-<?= erdet_html((string) $status['tone']) ?><?= $showExercisePopup ? ' statusHero-withExercise' : '' ?>">
      <div class="statusHeroInner">
        <p class="statusQuestion"><?= erdet_html((string) $status['question']) ?></p>
        <h1 class="statusAnswer"><?= erdet_html((string) $status['label']) ?></h1>
        <?php if ($showStatusExplanation): ?>
          <p class="statusExplanation"><?= erdet_html((string) $status['message']) ?></p>
        <?php endif; ?>
        <?php if ($status['status'] === 'yes'): ?>
          <p class="statusAdvice">
            Følg rådene i aktivt Nødvarsel.
            <a href="<?= erdet_html(ERDET_NODVARSEL_ADVICE_URL) ?>">Les hva rådene fra Nødvarsel betyr</a>.
          </p>
        <?php endif; ?>
      </div>

      <?php if ($showExercisePopup): ?>
        <aside class="exercisePopup" aria-label="Militær øvelse">
          <p class="exercisePopupLabel">Militær aktivitet</p>
          <h2>Forsvaret melder om pågående øvelse</h2>
          <ul>
            <?php foreach ($militaryExerciseNotices as $notice): ?>
              <li>
                <a href="<?= erdet_html((string) $notice['url']) ?>"><?= erdet_html((string) $notice['title']) ?></a><?=
                  $notice['location'] ? ': ' . erdet_html((string) $notice['location']) : ''
                ?><?= $notice['dateText'] ? ' (' . erdet_html((string) $notice['dateText']) . ')' : '' ?>
              </li>
            <?php endforeach; ?>
          </ul>
          <p>Dette påvirker ikke JA/NEI-statusen.</p>
        </aside>
      <?php endif; ?>
    </section>

    <section class="faqSection" aria-labelledby="faq-title">
      <div class="faqInner">
        <p class="sectionKicker">FAQ</p>
        <h2 id="faq-title">Spørsmål og svar</h2>
        <div class="faqList">
          <?php foreach ($faqItems as $item): ?>
            <article class="faqItem">
              <h3><?= erdet_html($item['question']) ?></h3>
              <p><?= erdet_html($item['answer']) ?></p>
            </article>
          <?php endforeach; ?>
        </div>
      </div>
    </section>

    <footer class="sourceCredit">
      Data om aktive nødvarsler kommer fra nodvarsel.no.
      Se <a href="<?= erdet_html(ERDET_NODVARSEL_HOME_URL) ?>">nodvarsel.no</a>
      og <a href="<?= erdet_html(ERDET_NODVARSEL_RSS_INFO_URL) ?>">RSS-informasjonen</a>.
    </footer>
  </main>
</body>
</html>
