<template>
  <div class="page-container md-layout-column">
    <md-toolbar class="md-primary">
      <md-button class="md-icon-button" @click="showNavigation = true">
        <md-icon>menu</md-icon>
      </md-button>
      <span class="md-title">
        Nuxt + Vue Material
      </span>

      <div class="md-toolbar-section-end">
        <md-button @click="showSidepanel = true">
          Favorites
        </md-button>
      </div>
    </md-toolbar>

    <md-drawer :md-active.sync="showNavigation">
      <md-toolbar class="md-transparent" md-elevation="0">
        <span class="md-title">
          My App name
        </span>
      </md-toolbar>

      <md-list>
        <md-list-item>
          <md-icon>move_to_inbox</md-icon>
          <span class="md-list-item-text">
            Inbox
          </span>
        </md-list-item>

        <md-list-item>
          <md-icon>send</md-icon>
          <span class="md-list-item-text">
            Sent Mail
          </span>
        </md-list-item>

        <md-list-item>
          <md-icon>delete</md-icon>
          <span class="md-list-item-text">
            Trash
          </span>
        </md-list-item>

        <md-list-item>
          <md-icon>error</md-icon>
          <span class="md-list-item-text">
            Spam
          </span>
        </md-list-item>
      </md-list>
    </md-drawer>

    <md-drawer :md-active.sync="showSidepanel" class="md-right">
      <md-toolbar class="md-transparent" md-elevation="0">
        <span class="md-title">
          Favorites
        </span>
      </md-toolbar>

      <md-list>
        <md-list-item>
          <span class="md-list-item-text">
            Abbey Christansen
          </span>

          <md-button class="md-icon-button md-list-action">
            <md-icon class="md-primary">
              chat_bubble
            </md-icon>
          </md-button>
        </md-list-item>

        <md-list-item>
          <span class="md-list-item-text">
            Alex Nelson
          </span>

          <md-button class="md-icon-button md-list-action">
            <md-icon class="md-primary">
              chat_bubble
            </md-icon>
          </md-button>
        </md-list-item>

        <md-list-item>
          <span class="md-list-item-text">
            Mary Johnson
          </span>

          <md-button class="md-icon-button md-list-action">
            <md-icon>chat_bubble</md-icon>
          </md-button>
        </md-list-item>
      </md-list>
    </md-drawer>

    <md-content>
      Lorem ipsum dolor sit amet, consectetur adipisicing elit. Error quibusdam, non molestias et! Earum magnam, similique, quo recusandae placeat dicta asperiores modi sint ea repudiandae maxime? Quae non explicabo, neque.
    </md-content>
  </div>
</template>

<script>
export default {
  name: 'Sidenav',
  data: () => ({
    showNavigation: false,
    showSidepanel: false
  })
}
</script>

<style scoped>
  .page-container {
    min-height: 100vh;
    overflow: hidden;
    position: relative;
    border: 1px solid rgba(#000, 0.12);
  }

  .md-drawer {
    width: 230px;
    max-width: calc(100vw - 125px);
  }

  .md-content {
    padding: 16px;
  }
</style>
