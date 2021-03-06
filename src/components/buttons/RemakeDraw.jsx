import React from 'react';
import * as Yup from 'yup';
import { useDispatch } from 'react-redux';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, DialogTitle, DialogActions, DialogContent, TextField } from '@material-ui/core';
import InputAdornment from '@material-ui/core/InputAdornment';
import IconButton from '@material-ui/core/IconButton';
import ClearIcon from '@material-ui/icons/Clear';
import { yupResolver } from '@hookform/resolvers/yup';

export const RemakeDrawModal = (props) => {
  const { drawId, open, setOpen } = props;

  const { t } = useTranslation();
  const dispatch = useDispatch();
  const defaultValues = { description: '' };
  const validationSchema = Yup.object().shape({ description: Yup.string().required() });
  const { setValue, control, handleSubmit } = useForm({
    resolver: yupResolver(validationSchema),
    defaultValues,
    mode: 'onBlur'
  });

  const onSubmit = (auditData) => {
    setOpen(false);
    dispatch({
      type: 'tournamentEngine',
      payload: { methods: [{ method: 'regenerateDrawDefinition', params: { drawId, auditData } }] }
    });
  };

  const onClickX = () => setValue('description', '');

  return (
    <>
      <Dialog disableBackdropClick={false} open={open} maxWidth={'md'} onClose={() => setOpen(false)}>
        <DialogTitle>
          <div style={{ minWidth: 400 }}>Remake Draw?</div>
        </DialogTitle>
        <DialogContent>
          <Controller
            name="description"
            control={control}
            render={({ field: { onChange, value }, formState: { errors } }) => (
              <TextField
                required
                fullWidth
                autoFocus
                value={value}
                id="description"
                variant="outlined"
                label={'Description'}
                onChange={onChange}
                placeholder={'Reason for re-making draw...'}
                helperText={errors.description && <span style={{ color: 'red' }}>Required</span>}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton aria-label="clear input field" onClick={onClickX} edge="end">
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            )}
          />
        </DialogContent>
        <DialogActions style={{ marginBottom: '1em', paddingRight: '1em' }}>
          <Button onClick={() => setOpen(false)} color="secondary" variant="outlined">
            {' '}
            {t('ccl')}{' '}
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={false} color="primary" variant="outlined">
            {' '}
            {t('sbt')}{' '}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
