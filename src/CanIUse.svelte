<script>
  import { onMount } from "svelte";
  export let type;
  export let browsers;

  let hovering = false;
  let entries = [];
  let remaining_count = 0;
  let remaining_usage = 0;

  function browserExists(agents, browserId) {
    return !!agents[browserId];
  }

  function browserDisplayName(agents, browserId) {
    return agents[browserId].browser;
  }

  function browserCurrentVersion(agents, browserId) {
    return agents[browserId].current_version;
  }

  function browserUsage(agents, browserId) {
    const all_versions = agents[browserId].usage_global;
    return Object.values(all_versions).reduce((a, b) => a + b, 0);
  }

  function statToValue(stat) {
    switch (stat[0]) {
      case "y":
        return 2;
      case "n":
        return 0;
      default:
        return 1;
    }
  }

  onMount(async () => {
    const response = await fetch(
      "https://raw.githubusercontent.com/Fyrd/caniuse/master/fulldata-json/data-2.0.json"
    );
    const json = await response.json();
    const data = json.data;
    const agents = json.agents;

    const typeData = data[type];
    if (!typeData) {
      return;
    }

    const stats = typeData.stats;

    let browserIds = [];
    if (!browsers || !browsers.length) {
      browserIds = Object.keys(agents);
    } else {
      browserIds = JSON.parse(browsers.replace(/'/g, '"'));
    }

    entries = [];
    if (browserIds && browserIds.length) {
      for (const browserId of browserIds) {
        if (!browserExists(agents, browserId)) {
          continue;
        }
        const version = browserCurrentVersion(agents, browserId);
        const name = browserDisplayName(agents, browserId);
        const usage = browserUsage(agents, browserId);
        const stat = stats[browserId][version];
        entries.push({ name, version, stat, usage });
      }
    }

    entries = entries.sort((entryA, entryB) => {
      const valueA = statToValue(entryA.stat);
      const valueB = statToValue(entryB.stat);
      if (valueA === valueB) {
        return entryA.usage < entryB.usage ? 1 : -1;
      }
      return valueA < valueB ? 1 : -1;
    });

    remaining_count = Object.keys(agents).length - browserIds.length;

    const remainingBrowsers = Object.keys(agents).filter(
      a => browsers.indexOf(a) < 0
    );
    remaining_usage = 0;
    for (const browserId of remainingBrowsers) {
      remaining_usage += browserUsage(agents, browserId);
    }
  });
</script>

<style>
  .stats {
    display: flex;
  }

  .stat {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 30px;
    color: white;
    background-color: #a8bd04;
    margin: 0.25rem;
    padding: 0.25rem 1rem;
    border-radius: 10px;
  }

  .stat.y {
    background-color: #39b54a;
  }

  .stat.n {
    background-color: #c44230;
  }

  .stat.gray {
    background-color: gray;
  }

  .stat .hovering {
    color: transparent;
  }

  .stat .usage {
    position: absolute;
    margin: 0rem;
  }
</style>

<svelte:options tag={null} />
<div
  class="stats"
  on:mouseenter={() => (hovering = true)}
  on:mouseleave={() => (hovering = false)}>
  {#each entries as entry}
    <div class="stat {entry.stat}">
      <p class={hovering ? 'hovering' : ''}>{entry.name} {entry.version}</p>
      {#if hovering}
        <p class="usage">{Math.round(entry.usage * 100) / 100} %</p>
      {/if}
    </div>
  {/each}
  {#if remaining_count}
    <div class="stat gray">
      <p class={hovering ? 'hovering' : ''}>+{remaining_count}</p>
      {#if hovering}
        <p class="usage">{Math.round(remaining_usage * 100) / 100} %</p>
      {/if}
    </div>
  {/if}
</div>
