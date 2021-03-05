import Typography from '@material-ui/core/Typography'
import AppBar from '@material-ui/core/AppBar'
import IconButton from '@material-ui/core/IconButton'
import Button from '@material-ui/core/Button'
import Toolbar from '@material-ui/core/Toolbar'
import MobileStepper from '@material-ui/core/MobileStepper'
import ArrowBackIosIcon from '@material-ui/icons/ArrowBackIos'
import ArrowForwardIosIcon from '@material-ui/icons/ArrowForwardIos'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import CloseIcon from '@material-ui/icons/Close'
import { observer, PropTypes } from 'mobx-react'
import React, { useRef, useState } from 'react'
import Drawer from './Drawer'

const useStyles = makeStyles(theme => ({
  defaultDrawer: {},
  components: {
    display: 'block',
  },
  drawerCloseButton: {
    float: 'right',
    '&:hover': {
      backgroundColor: fade(
        theme.palette.secondary.contrastText,
        theme.palette.action.hoverOpacity,
      ),
      '@media (hover: none)': {
        backgroundColor: 'transparent',
      },
    },
  },
  drawerToolbar: {
    paddingLeft: theme.spacing(2),
  },
  drawerToolbarCloseButton: {
    flexGrow: 1,
  },
  drawerLoading: {
    margin: theme.spacing(2),
  },
  navigationButton: {
    '&:hover': {
      backgroundColor: fade(
        theme.palette.secondary.contrastText,
        theme.palette.action.hoverOpacity,
      ),
      '@media (hover: none)': {
        backgroundColor: 'transparent',
      },
    },
  },
}))
const DrawerWidget = observer(props => {
  const { session } = props
  const { visibleWidget, visibleWidgetIndex, pluginManager } = session
  const {
    ReactComponent,
    HeadingComponent,
    heading,
  } = pluginManager.getWidgetType(visibleWidget.type)
  const classes = useStyles()
  const activeWidget = Array.from(session.activeWidgets.values())[
    visibleWidgetIndex
  ]

  const handleNext = () => {
    console.log('I clicked next, visibleWidgetIndex: ', visibleWidgetIndex)
    if (visibleWidgetIndex + 1 <= session.activeWidgets.size - 1) {
      session.setVisibleWidgetIndex(visibleWidgetIndex + 1)
      console.log('after setting', visibleWidgetIndex)
    }
  }

  //  activeWidget to be 2
  // [1, 2, 3]
  const handleBack = () => {
    console.log('I clicked back, visibleWidgetIndex: ', visibleWidgetIndex)
    if (visibleWidgetIndex - 1 >= 0) {
      session.setVisibleWidgetIndex(visibleWidgetIndex - 1)
      console.log('after setting', visibleWidgetIndex)
    }
  }

  // console.log(ReactComponent)
  // console.log('active widget', session.activeWidgets)
  console.log('size', session.activeWidgets.size)
  // console.log('visible widget index', session.visibleWidgetIndex)
  // console.log('visible widget', visibleWidget)
  // TODO: use widget id to get the wideget then show the widget
  // TODO: use navigation either stepper or butttons
  // TODO: back and forth buttons
  // TODO: fix spacing between navigation and header
  console.log('before render', visibleWidgetIndex)
  return (
    <Drawer session={session} open={Boolean(session.activeWidgets.size)}>
      <div className={classes.defaultDrawer}>
        <AppBar position="static" color="secondary">
          <Toolbar disableGutters className={classes.drawerToolbar}>
            <IconButton
              onClick={handleBack}
              className={classes.navigationButton}
            >
              <ArrowBackIosIcon aria-label="Back" />
            </IconButton>
            <Typography variant="h6" color="inherit">
              {HeadingComponent ? (
                <HeadingComponent model={visibleWidget} />
              ) : (
                heading || undefined
              )}
            </Typography>
            <IconButton
              onClick={handleNext}
              className={classes.navigationButton}
            >
              <ArrowForwardIosIcon aria-label="Next" />
            </IconButton>
            <div className={classes.drawerToolbarCloseButton} />
            <IconButton
              className={classes.drawerCloseButton}
              data-testid="drawer-close"
              color="inherit"
              aria-label="Close"
              onClick={() => {
                session.hideWidget(activeWidget)
              }}
            >
              <CloseIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
        <ReactComponent model={activeWidget} session={session} />
      </div>
    </Drawer>
  )
})

DrawerWidget.propTypes = {
  session: PropTypes.observableObject.isRequired,
}

export default DrawerWidget
